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
const eventEmitter = new EventEmitter();

let lantern = null;
let presence = false;
let alluser = false;
let heartrate = 0;
let polarDevice = null;
let disconnected = false;
const timerScan = 15;
const {ID, GROUP, IP} = process.env;

const dontUseDevice = true;

if (!dontUseDevice) {
	import('./src/bluetooth.js');
}

client.on('error', function (err) {
	console.dir(err);
});

client.on('message', async function (topic, message) {
  console.log("🚀 ~ file: index.js ~ line 37 ~ topic", topic);
  let state = await getState();
  if (state.name === 'boot') {
		return;
	}
	if (topic === `/station/${ID}/reboot`) {
		eventEmitter.emit('processexit', 'Reboot!');
    return
  }
  if (lantern !== null) { 
    if (topic === `/${lantern.data.id}/status`) {
      await metrics({ message: `Lantern ${lantern.data.id} offline` });
      await metrics({ lantern: "-" });
      await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: "50, 50, 50, 255" });
      console.log(`Lantern ${lantern.data.id} offline`);
      client.unsubscribe(`/${lantern.data.id}/status`);
      sleep(2000);
      eventEmitter.emit('getLantern');
    }
  }

  if (topic === `/station/${ID}/presence`) {
		let buff = message.toString();
		let value = JSON.parse(buff);
		presence = JSON.parse(value.presence.toLowerCase());
    console.log("🚀 ~ file: index.js ~ line 61 ~ presence", presence);
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
		//eventEmitter.emit('presence');
	}
});

eventEmitter.on('disconnected', async () => {
	disconnected = true;
});

eventEmitter.on('getLantern', async () => {
	try {
		await getLantern();
	} catch (error) {
		console.log(error);
		await sleep(2000);
		eventEmitter.emit('getLantern');
	}
});

eventEmitter.on('presence', async (value) => {
  if (presence) { eventEmitter.emit('presence/true'); } else if (!presence) { eventEmitter.emit('presence/false'); }
});

eventEmitter.on('ready', async () => {
  await setState(0);
  console.log('Ready!');
  await metrics({message: 'Ready to scan'});
  await metrics({lantern: lantern.data.id});
  console.log(`${lantern.data.id} / ${heartrate}`);
	if (presence) {
		eventEmitter.emit('presence/true');
  }
});

eventEmitter.on('done', async () => {
	await setState(2);
	client.publish(`/lantern/${lantern.id}/audio/ignite`);
	await metrics({message: 'Done!'});
  await metrics({ timer: `00:00:${timerScan}` });
  await metrics({ lantern: "-" });
  lantern = null;
  if (!presence) {
    done();
  }
});

eventEmitter.on('presence/true', async () => {
	if (lantern === null) {
		return;
  }
  let state = await getState();
  if (presence && state.name === 'ready') {
    await setState(7);
    await metrics({ message: 'User Ready, waiting' });
		while (!alluser) {
      await checkUsers();

    }
    if (alluser) {
      await scan()
    }

	}
});

eventEmitter.on('presence/false', async (value) => {
  let state = await getState();
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
	await metricsReset();
	await server();

	await setState(6);
	await metrics({message: 'Booting...'});

	if (!dontUseDevice) {
		while (polarDevice === null) {
			try {
				polarDevice = await connectToDevice();
			} catch (err) {
				console.log('🚀 ~ file: index.js ~ line 187 ~ boot ~ err', err);
			}
			await sleep(3000);
			return;
		}

		polarDevice.on('valuechanged', async (buffer) => {
			let json = JSON.stringify(buffer);
			let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
			if (deviceHeartrate < 70) {
				heartrate = randomIntFromInterval(30, 50);
			}
			if (deviceHeartrate >= 70) {
				heartrate = randomIntFromInterval(50, 60);
			}
			if (deviceHeartrate > 80) {
				heartrate = randomIntFromInterval(80, 90);
			}
			heartrate = deviceHeartrate;
			await metrics({bpm: heartrate});
		});
	}
	heartrate = randomIntFromInterval(70, 90);
	await metrics({bpm: heartrate});
	eventEmitter.emit('getLantern');
})();

/*------------------------------------------------------*/

async function getLantern() {
  if (lantern !== null) { return }
  await setState(5);
	if (disconnected) {
		heartrate = randomIntFromInterval(70, 90);
	}
	return new Promise(async function (resolve, reject) {
		if (!(await pingAPI())) {
			reject();
		}
		try {
			lantern = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
			await axios.put(`http://${IP}/api/stations/${ID}`, {rgb: lantern.data.rgb});
			eventEmitter.emit('ready');
			client.subscribe(`/${lantern.data.id}/status`);
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
  let state = await getState();
  if (state.name === 'outoflantern') { return }
	return new Promise(async (resolve, reject) => {
		let arr = await getStations();
		var isAllTrue = Object.keys(arr).every(function (key) {
			return arr[key].presence === true;
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
