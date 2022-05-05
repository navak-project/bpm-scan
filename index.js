// when lantern reset, reset the station also by mqtt
// also if lantern crash, ping status if false, then reset the station

import 'dotenv/config';
import {metrics, metricsReset} from './src/metrics.js';
import {setState, getState} from './src/states.js';
import axios from 'axios';
import {clientConnect} from './src/mqtt.js';
import { ConnectionToDevice } from './src/device.js';
import isReachable from 'is-reachable';
import {Timer} from 'easytimer.js';
const timerInstance = new Timer();
import {server} from './src/server.js';
import {EventEmitter} from 'events';
export const eventEmitter = new EventEmitter();
import './src/artnet.cjs';

const client = await clientConnect();
let lantern = null;
let presence = false;
let alluser = false;
let heartrate = 0;
const polar = new ConnectionToDevice(
  'A0:9E:1A:9F:0E:B4',
  'polarStatus',
  'polarState',
  '0000180d-0000-1000-8000-00805f9b34fb',
  '00002a37-0000-1000-8000-00805f9b34fb',
  'connectToPolar'
);
let _POLARDEVICE = null;

const presenceDevice = new ConnectionToDevice(
  '34:94:54:39:18:A6',
  'presenceStatus',
  'presenceState',
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  'beb5483e-36e1-4688-b7f5-ea07361b26a8',
  'connectToPresence'
);
let _PRESENCEDEVICE = null;

const timerScan = 15;
const {ID, GROUP, IP} = process.env;

client.on('error', function (err) {
	console.dir(err);
});

client.on('message', async function (topic, message) {
	console.log(topic);
	let state = await getState();
	if (state.name === 'boot') {
		return;
	}
	if (topic === `/station/${ID}/reboot`) {
		eventEmitter.emit('processexit', 'Reboot!');
		return;
	}
	if (lantern !== null) {
		if (topic === `/${lantern.data.id}/status` || topic === `/lanterns/${lantern.data.id}/reset`) {
			await metrics({message: `Lantern ${lantern.data.id} offline`});
			await metrics({lantern: null});
			await axios.put(`http://${IP}/api/stations/${ID}`, {rgb: '50, 50, 50, 255', lantern: null});
			client.unsubscribe(`/${lantern.data.id}/status`);
			client.unsubscribe(`/lanterns/${lantern.data.id}/reset`);
			sleep(2000);
      lantern = null;
      eventEmitter.emit('getLantern');
		}
	}

	if (topic === `/station/${ID}/presence`) {
		let buff = message.toString();
		let value = JSON.parse(buff);
		presence = JSON.parse(value.presence.toLowerCase());
    console.log("🚀 ~ file: index.js ~ line 60 ~ presence", presence);
		await metrics({presence: presence});
		switch (presence) {
			case true:
				eventEmitter.emit('presence/true');
				break;
			case false:
				eventEmitter.emit('presence/false');
				break;
			default:
				break;
		}
	}
});

eventEmitter.on('connected', async () => {
  if (polar.device === null) {
    return;
  }

  _POLARDEVICE = await polar.device;

  _POLARDEVICE.on('valuechanged', async (buffer) => {
    let json = JSON.stringify(buffer);
    let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
    if (deviceHeartrate < 30 || deviceHeartrate > 180) {
      heartrate = randomIntFromInterval(70, 90);
      await metrics({ bpm: heartrate });
      return;
    }
    heartrate = deviceHeartrate;
    await metrics({ bpm: heartrate });
  });
});

eventEmitter.on('connectToPresence', async () => {
  //await sleep(3000);
  try {
    await presenceDevice.connect();
    if (presenceDevice.device === null) {
      return;
    }
    _PRESENCEDEVICE = await presenceDevice.device;
    _PRESENCEDEVICE.on('valuechanged', async (buffer) => {
      let json = JSON.stringify(buffer);
      let deviceValue = Math.max.apply(null, JSON.parse(json).data);
     // console.log("🚀 ~ file: index.js ~ line 123 ~ _PRESENCEDEVICE.on ~ deviceValue", deviceValue);
      // TODO add timer
// true if value true for more than 5 seconds


      if (deviceValue < 20 && !presence && timerInstance.getTimeValues().seconds > 1) {
        presence = true;
          eventEmitter.emit('presence/true');
        return
      }
      if (deviceValue > 25 && presence && timerInstance.getTimeValues().seconds > 1) {
        presence = false;
        eventEmitter.emit('presence/false');
        return
      }

      //await sleep(1000);
    });
  } catch (error) {
    console.log("🚀 ~ file: events.js ~ line 33 ~ eventEmitter.on ~ error", error);
    // console.log('No devices found!');
    // await metrics({polarStatus: 'No device'});
    // await metrics({polarState: 4});
    return;
  }
});


eventEmitter.on('connectToPolar', async () => {
    await polar.connect().then(async (device) => { 
      _POLARDEVICE = device;
      _POLARDEVICE.on('valuechanged', async (buffer) => {
        let json = JSON.stringify(buffer);
        let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
        if (deviceHeartrate < 30 || deviceHeartrate > 180) {
          heartrate = randomIntFromInterval(70, 90);
          await metrics({ bpm: heartrate });
          return;
        }
        heartrate = deviceHeartrate;
        await metrics({ bpm: heartrate });
      });

    }).catch(async (error) => { 
      console.log("🚀 ~ error:", error);
      eventEmitter.emit('connectToPresence');
    });
    /*if (polar.device === null) {
      return;
    }*/
});

async function connectBluetooth(deviceToConnect) {
  try {
    await deviceToConnect.connect();
    return deviceToConnect.device;
  } catch (error) {
    console.log("🚀 ~ error", error);
    await connectBluetooth(deviceToConnect)
    return;
  }
}

eventEmitter.on('getLantern', async () => {
  
});

eventEmitter.on('ready', async () => {
  await metrics({ lantern: lantern.data.id });
  await setState(0);
  if (presence) {
    eventEmitter.emit('presence/true');
    return;
  }
  await metrics({ message: 'Ready to scan' });
  console.log('Ready!');
});

eventEmitter.on('done', async () => {
  await setState(2);
  client.publish(`/lantern/${lantern.id}/audio/ignite`);
  await metrics({ lantern: null });
  lantern = null;
  if (!presence) {
    done();
    return;
  }
  await metrics({ message: 'Done!' });
});

eventEmitter.on('presence/true', async () => {
  let state = await getState();
  console.log('Presence true');
  await metrics({ presence: true });
  if (presence && state.name === 'ready') {
    await setState(7);
    await metrics({ message: 'User Ready, waiting' });
    /*while (!alluser) {
      await checkUsers();
    }*/
   // if (alluser) {
      await scan();
   // }
  }
});

eventEmitter.on('presence/false', async (value) => {
  let state = await getState();
  console.log('Presence false');
  await metrics({ presence: false });
  alluser = false;
  if (state.name === 'scan' || state.name == 'outoflantern') {
    return;
  }
  if (state.name === 'done') {
    done();
    return;
  }
  eventEmitter.emit('ready');
});

eventEmitter.on('processexit', async (msg) => {
  await metrics({ status: false });
  process.exit(0);
});



/*------------------------------------------------------*/

(async function () {
  await server();
	await metricsReset();
	await setState(6);
	await metrics({message: 'Booting...'});
  await metrics({ bpm: heartrate });
  //eventEmitter.emit('getLantern');
  await getLantern();

 /* try {
  } catch (error) {
    await sleep(2000);
    await getLantern();
  }*/

  _PRESENCEDEVICE = await connectBluetooth(presenceDevice);
  _PRESENCEDEVICE.on('valuechanged', async (buffer) => {
  let json = JSON.stringify(buffer);
  let deviceValue = Math.max.apply(null, JSON.parse(json).data);
  if (deviceValue < 38) {
    presence = true;
    eventEmitter.emit('presence/true');
  }
  if (deviceValue < 45) {
    presence = false;
    eventEmitter.emit('presence/false');
    }
  });
  //eventEmitter.emit('connectToPolar');

/*  try {
    await presenceDevice.connect();
    if (presenceDevice.device === null) {
      return;
    }
    _PRESENCEDEVICE = await polar.device;
    _PRESENCEDEVICE.on('valuechanged', async (buffer) => {
      let json = JSON.stringify(buffer);
      let deviceValue = Math.max.apply(null, JSON.parse(json).data);
      if (deviceValue < 38) {
        presence = true;
        eventEmitter.emit('presence/true');
      }
      if (deviceValue < 45) {
        presence = false;
        eventEmitter.emit('presence/false');
      }

    });
  } catch (error) {
    console.log("🚀 ~ file: events.js ~ line 33 ~ eventEmitter.on ~ error", error);
    // console.log('No devices found!');
    // await metrics({polarStatus: 'No device'});
    // await metrics({polarState: 4});
    return;
  }*/


  

})();

/*------------------------------------------------------*/

async function getLantern() {
	await setState(5);
	return new Promise(async function (resolve, reject) {
    if (!(await pingAPI())) {
      await pingAPI();
			//reject();
		}
		try {
			lantern = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
			await axios.put(`http://${IP}/api/stations/${ID}`, {rgb: lantern.data.rgb});
			eventEmitter.emit('ready');
			client.subscribe(`/lanterns/${lantern.data.id}/reset`);
			client.subscribe(`/${lantern.data.id}/status`);
			resolve(lantern.data.id);
		} catch (error) {
			await setState(3);
      await metrics({ message: error.response.data });
      await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: '50, 50, 50, 255', lantern: null });
      await metrics({ message: 'Retrying...' });
      sleep(2000);
      await getLantern();
			//reject(error.response.data);
		}
	});
}

async function done() {
	await metrics({message: 'User is done and left!'});
	await metrics({timer: `00:00:${timerScan}`});
	await setState(9); //remove from touch
	await sleep(18000);
  //eventEmitter.emit('getLantern');
  await getLantern();
 /* try {
    
  } catch (error) {
    await sleep(2000);
    await getLantern();
  }*/
}

async function getStations() {
	return new Promise(async (resolve, reject) => {
		await axios
			.get(`http://192.168.1.209:8081/api/stations/`)
			.then((val) => {
				resolve(val.data);
			})
			.catch((err) => {
				reject(err);
			});
	});
}

async function checkUsers() {
	return new Promise(async (resolve, reject) => {
		let arr = await getStations();
		var isAllTrue = Object.keys(arr).every(function (key) {
			if (arr[key].presence === true && arr[key].lantern != null) return true;
		});
		alluser = isAllTrue;
		resolve(alluser);
	}).catch((err) => {
		reject(err);
	});
}

async function scan() {
	timerInstance.addEventListener('secondsUpdated', async function (e) {
    await metrics({ timer: timerInstance.getTimeValues().toString() });
    if (polar.device === null) {
      heartrate = randomIntFromInterval(70, 90);
      await metrics({ bpm: heartrate });
    }
	});
	timerInstance.addEventListener('targetAchieved', async function (e) {
    timerInstance.stop();
		await axios.put(`http://${IP}/api/lanterns/${lantern.data.id}`, {pulse: heartrate});
		eventEmitter.emit('done');
	});
	await setState(1);
  await metrics({ message: 'Scanning...' });
  
	timerInstance.start({countdown: true, startValues: {seconds: timerScan}});
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function randomIntFromInterval(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

async function pingAPI() {
	var status = await isReachable(IP);
	if (status) {
		return true;
	} else {
		return false;
	}
}
