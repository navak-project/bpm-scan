// when lantern reset, reset the station also by mqtt
// also if lantern crash, ping status if false, then reset the station

import 'dotenv/config';
import {metrics, metricsReset} from './src/metrics.js';
import {setState, getState} from './src/states.js';
import axios from 'axios';
import {clientConnect} from './src/mqtt.js';
const {client} = clientConnect();
import isReachable from 'is-reachable';
import {Timer} from 'easytimer.js';
const timerInstance = new Timer();
import {server} from './src/server.js';
import {EventEmitter} from 'events';
export const eventEmitter = new EventEmitter();
import { connectToDevice } from './src/Bluetooth.js'
 
let lantern = null;
let presence = false;
let alluser = false;
let heartrate = 0;
let polarDevice = null;
let disconnected = false;
const timerScan = 15;
const {ID, GROUP, IP} = process.env;

const dontUseDevice = false;

client.on('error', function (err) {
	console.dir(err);
});

client.on('message', async function (topic, message) {
  console.log("🚀 ~ file: index.js ~ line 37 ~ topic", topic);
  let state = await getState();
  if (state.name === 'boot') {
		return;
  }
  //if (state.name === 'outoflantern') { return }
	if (topic === `/station/${ID}/reboot`) {
		eventEmitter.emit('processexit', 'Reboot!');
    return
  }
  if (lantern !== null) { 
    if (topic === `/${lantern.data.id}/status` || topic === `/lanterns/${lantern.data.id}/reset` ) {
      await metrics({ message: `Lantern ${lantern.data.id} offline` });
      await metrics({ lantern: null });
      await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: "50, 50, 50, 255", lantern: null });
      console.log(`Lantern ${lantern.data.id} offline`);
      client.unsubscribe(`/${lantern.data.id}/status`);
      client.unsubscribe(`/lanterns/${lantern.data.id}/reset`);
      sleep(2000);
      eventEmitter.emit('processexit');
    }
  }

  if (topic === `/station/${ID}/presence`) {
		let buff = message.toString();
		let value = JSON.parse(buff);
		presence = JSON.parse(value.presence.toLowerCase());
    await metrics({ presence: presence });
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

eventEmitter.on('disconnected', async () => {
  //disconnected = true;
  polarDevice = null
  heartrate = randomIntFromInterval(70, 90);
  console.log("🚀 ~ file: index.js ~ line 87 ~ eventEmitter.on ~ disconnected");
  await sleep(3000);
  polarDevice = await connectToDevice();
});

eventEmitter.on('getLantern', async () => {
	try {
		await getLantern();
	} catch (error) {
		//console.log(error);
		await sleep(2000);
		eventEmitter.emit('getLantern');
	}
});

eventEmitter.on('ready', async () => {
  await metrics({ lantern: lantern.data.id });
  await setState(0);
  if (presence) {
    eventEmitter.emit('presence/true');
    return
  }
  await metrics({message: 'Ready to scan'});

  console.log('Ready!');

});

eventEmitter.on('done', async () => {
  await setState(2);
  client.publish(`/lantern/${lantern.id}/audio/ignite`);
  await metrics({ lantern: null });
  lantern = null;
  if (!presence) {
    done();
    return
  }
  await metrics({message: 'Done!'});
});

eventEmitter.on('presence/true', async () => {
  let state = await getState();
  if (presence && state.name === 'ready') {
    await setState(7);
    await metrics({ message: 'User Ready, waiting' });
    while (!alluser){
      await checkUsers();
    }
    if (alluser) {
      await scan()
    }
	}
});

eventEmitter.on('presence/false', async (value) => {
  let state = await getState();
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

(async function () {
  polarDevice = null;
  //console.log("🚀 ~ file: index.js ~ line 158 ~ polarDevice", polarDevice);
	await metricsReset();
	await server();

	await setState(6);
	await metrics({message: 'Booting...'});

	if (!dontUseDevice) {
			try {
				polarDevice = await connectToDevice();
        return
			} catch (err) {
        console.log('🚀 ~ file: index.js ~ line 187 ~ boot ~ err', err);
        eventEmitter.emit('processexit');
      }
    await sleep(3000);

		polarDevice.on('valuechanged', async (buffer) => {
			let json = JSON.stringify(buffer);
      let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
      console.log("🚀 ~ file: index.js ~ line 172 ~ polarDevice.on ~ deviceHeartrate", deviceHeartrate);
      if (deviceHeartrate < 60) {
        heartrate = randomIntFromInterval(70, 76);
        await metrics({ bpm: heartrate });
        return
      } else {
        heartrate = deviceHeartrate;
      }
		});
  } else {
      heartrate = randomIntFromInterval(70, 90);
      await metrics({bpm: heartrate});
  }
	eventEmitter.emit('getLantern');
})();

/*------------------------------------------------------*/

async function getLantern() {
  if (lantern !== null) { return }
  await setState(5);
	return new Promise(async function (resolve, reject) {
		if (!(await pingAPI())) {
			reject();
		}
		try {
			lantern = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
			await axios.put(`http://${IP}/api/stations/${ID}`, {rgb: lantern.data.rgb});
      eventEmitter.emit('ready');
      client.subscribe(`/lanterns/${lantern.data.id}/reset`);
      client.subscribe(`/${lantern.data.id}/status`);
      if (heartrate < 50) {
        heartrate = randomIntFromInterval(70, 90);
        await metrics({bpm: heartrate});
      }
			resolve(lantern.data.id);
		} catch (error) {
			await setState(3);
			await metrics({message: error.response.data});
			reject(error.response.data);
		}
	});
}

async function done() {
  await metrics({ message: 'User is done and left!' });
  await metrics({ timer: `00:00:${timerScan}` });
	await setState(9); //remove from touch
  await sleep(18000);
  await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: "50, 50, 50, 255" });
	eventEmitter.emit('getLantern');
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
     if (arr[key].presence === true && arr[key].lantern != null)
       return true;
   });
   alluser = isAllTrue;
   resolve(alluser);
 }).catch((err) => {
   reject(err);
 });
}

async function scan() {
	timerInstance.addEventListener('secondsUpdated', async function (e) {
		await metrics({timer: timerInstance.getTimeValues().toString()});
	});
	timerInstance.addEventListener('targetAchieved', async function (e) {
		timerInstance.stop();
		await axios.put(`http://${IP}/api/lanterns/${lantern.data.id}`, {pulse: heartrate});
		eventEmitter.emit('done');
	});
	await setState(1);
	await metrics({message: 'Scanning...'});
	timerInstance.start({countdown: true, startValues: {seconds: timerScan}});
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function randomIntFromInterval(min, max) {
	// min and max included
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
