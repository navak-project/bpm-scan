// every station is presence -> activate


import 'dotenv/config';
import {createBluetooth} from 'node-ble';
const {bluetooth} = createBluetooth();
import axios from 'axios';
import {Timer} from 'easytimer.js';
import {exec} from 'child_process';
import {clientConnect} from './mqtt.js';
const {client} = clientConnect();
import {EventEmitter} from 'events';
const eventEmitter = new EventEmitter();
import isReachable from 'is-reachable';
const timerInstance = new Timer();
import {server} from './server.js';

let _DONE = false;
let _BOOTING = false;
let _USER = null;
let _PRESENCE = false;
let _READYTOSCAN = false;
let _POLARBPM = 0;
let _SCANFAIL = false;
let _SCANNING = false;
let _CHECKFORALLUSER = false;
let _ALLUSER = false;
let inter;

const _TIMERSCAN = 15;

let _CURENTSTATE;

let _NOUSER = false;
const {ID, GROUP, IP} = process.env;

client.on('error', function (err) {
	console.dir(err);
});

client.on('message', async function (topic, message) {
	if (topic === `/station/${ID}/reboot`) {
		eventEmitter.emit('processexit', 'Reboot!');
	}
	if (_BOOTING) {
		return;
	}
	// message is Buffer
	let buff = message.toString();
	let value = JSON.parse(buff);
	_PRESENCE = JSON.parse(value.presence.toLowerCase());
	await updateStationsMetrics({presence: _PRESENCE});
	eventEmitter.emit('presence', _PRESENCE);
});

// listen to the event
eventEmitter.on('init', async () => {
	await init()
		.then(() => {
			console.log('init done!');
		})
		.catch(async (err) => {
			console.log(err);
			await sleep(2000);
			eventEmitter.emit('init');
		});
});

// listen to the event
eventEmitter.on('ready', async () => {
	_BOOTING = false;
	_READYTOSCAN = true;
	_DONE = false;
  _SCANFAIL = false;
 
	if (validate()) {
		//await sleep(1000);
		//eventEmitter.emit('presence/true');
		return;
	}
	await setState(0);
	await updateStationsMetrics({message: 'Ready to scan'});
	console.log('Ready');
});

// listen to the event
eventEmitter.on('done', async () => {
	await setState(2);
	await updateStationsMetrics({message: 'Done!'});
	await updateStationsMetrics({timer: `00:00:${_TIMERSCAN}`});
});

eventEmitter.on('presence/true', async () => {
	if (_SCANFAIL == true || _NOUSER == true) {
		return;
	}
  await setState(7);
  await updateStationsMetrics({ message: 'User Ready, waiting' });
  //await sleep(1200);
  if (validate() && _READYTOSCAN) {
    inter = setInterval(() => {
      eventEmitter.emit('checkUser'); 
    }, 500);
    
		//await scan();
	}
});

eventEmitter.on('checkUser', async () => {
  if (_ALLUSER === true) {
    clearInterval(inter);
    await scan();
  }
  else {
    await checkUsers()
  }
});
  console.log("🚀 ~ file: index.js ~ line 120 ~ eventEmitter.on ~ checkUser");


eventEmitter.on('presence/false', async (value) => {
  await checkUsers();
	if (_SCANFAIL == true || _NOUSER == true) {
		return;
  }
  if (!_DONE && _READYTOSCAN) {
    if (_ALLUSER === false) {
      eventEmitter.emit('ready');
    }
		if (_SCANNING == false) {
			return;
    }
    scanFail();
    timerInstance.stop();
    await updateStationsMetrics({timer: `00:00:${_TIMERSCAN}`});
	}
	if (_DONE && !_READYTOSCAN) {
		done();
	}
});

// listen to the event
eventEmitter.on('presence', async (value) => {
	if (value == true) {
		eventEmitter.emit('presence/true');
	}
	if (value == false) {
		eventEmitter.emit('presence/false');
  }
  await updateStationsMetrics({ presence: _PRESENCE });
});

eventEmitter.on('processexit', async (msg) => {
	//await setState(8);
//	await updateStationsMetrics({message: msg});
	//await sleep(5000);
	await updateStationsMetrics({status: false});
	process.exit(0);
});



// BOOT
boot();
async function boot() {
	await server();
	await pingAPI();
	await updateStationsMetrics({bpm: 0});
	await updateStationsMetrics({lantern: '-'});
	await updateStationsMetrics({message: '-'});
	// doomsday('sudo invoke-rc.d bluetooth restart', function (callback) { })
	// doomsday('sudo hostname -I', function (callback) { })
	_USER = null;
	_BOOTING = true;
	await setState(6);

	console.log('booting...');
	await updateStationsMetrics({message: 'Booting...'});
	await sleep(2000);

	/* -------------------------------------------------- */
	/* -------------------------------------------------- */
	// const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
	// 	if (err) {
	//     console.log(err);
	//     await updateStationsMetrics({ message: 'No bluetooth adapter' })
	//     sleep(2000);
	//     boot();
	//    // eventEmitter.emit('processexit', 'No bluetooth adapter');
	//     return;
	// 	}
	// });

	// console.log('Discovering device...');
	// await updateStationsMetrics({ message: 'Discovering device...' })

	// if (!(await adapter.isDiscovering())) {
	// 	await adapter.startDiscovery();
	// }

	// const device = await adapter.waitDevice('A0:9E:1A:9F:0E:B4').catch(async (err) => {
	// 	if (err) {
	//     console.log(err);
	//     //eventEmitter.emit('processexit', 'No device');
	//     await updateStationsMetrics({ message: 'No device' })
	//     sleep(2000);
	//     boot();
	//     return;
	// 	}
	// });

	// const macAdresss = await device.getAddress();
	// const deviceName = await device.getName();

	// console.log('Device:', macAdresss, deviceName);

	// try {
	// 	await device.connect();
	// } catch (err) {
	// 	console.log('🚀 ~ file: index.js ~ line 135 ~ init ~ err', err);
	//   await updateStationsMetrics({ message: err.text })
	//   sleep(2000);
	//   boot();
	//   //eventEmitter.emit('processexit', 'Disconnected');
	//   return;
	// }

	// console.log('Connected!');
	// await updateStationsMetrics({ message: 'Connected' })
	// device.on('disconnect', async function () {

	//   await updateStationsMetrics({ message: 'Disconnected' })
	//   sleep(2000);
	//   boot();
	//  // eventEmitter.emit('processexit', 'Disconnected');
	//   return;
	// });

	// const gattServer = await device.gatt();
	// const service = await gattServer.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
	// const heartrate = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
	// await heartrate.startNotifications();

	// _HEARTRATE = heartrate;
	// _HEARTRATE.on('valuechanged', async (buffer) => {
	// 	let json = JSON.stringify(buffer);
	// 	let bpm = Math.max.apply(null, JSON.parse(json).data);
	// 	/*if (bpm == 0 || bpm > 150) {
	//     bpm = randomIntFromInterval(70, 90);
	//   }*/
	//   if (bpm < 70 ) {
	//     bpm = randomIntFromInterval(30, 50);
	//   }
	//   if (bpm >= 70 ) {
	//     bpm = randomIntFromInterval(50, 60);
	//   }
	//   if (bpm > 80 ) {
	//     bpm = randomIntFromInterval(80, 90);
	//   }
	// 	_POLARBPM = bpm;
	//   await updateStationsMetrics({ bpm: _POLARBPM})
	// });
	/* -------------------------------------------------- */
	/* -------------------------------------------------- */
	//await sleep(5000);
	_POLARBPM = randomIntFromInterval(70, 90);
	await updateStationsMetrics({bpm: _POLARBPM});
	eventEmitter.emit('init');
}

function randomIntFromInterval(min, max) {
	// min and max included
	return Math.floor(Math.random() * (max - min + 1) + min);
}

async function init() {
	//await setState(5);
	_BOOTING = true;
	//console.log('Getting user...');
  _USER = null;
  await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: '50, 50, 50, 255' });
  await updateStationsMetrics({ lantern: '-' });
  _POLARBPM = randomIntFromInterval(70, 90);
  await updateStationsMetrics({bpm: _POLARBPM});
	//await updateStationsMetrics({ message: 'Getting user...' })
	//await sleep(3000);
	return new Promise(async function (resolve, reject) {
		let api = await pingAPI();
		if (api == false) {
			reject();
		}
		try {
			_USER = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
			console.log('🚀 ~ file: index.js ~ line 230 ~ _USER', _USER.data.id);
			await axios.put(`http://${IP}/api/stations/${ID}`, {rgb: _USER.data.rgb});
			await updateStationsMetrics({lantern: _USER.data.id});
			eventEmitter.emit('ready');
			_NOUSER = false;
			resolve();
		} catch (error) {
			//console.log(error.response.data);
			await setState(3);
			await updateStationsMetrics({message: error.response.data});
			//await updateStationsMetrics({ message: 'No lantern' })
			//console.log('No lantern, will try to get a user in 5 seconds...');
			_NOUSER = true;
			reject();
		}
	});
}

async function setLantern(userBpm, userColor) {
  await axios.put(`http://${IP}/api/lanterns/${_USER.data.id}`, { pulse: userBpm });
	eventEmitter.emit('done');
}

async function done() {
	await updateStationsMetrics({message: 'User is done and left!'});
	//await setState(9);
	await sleep(18000);
	eventEmitter.emit('init');
}
async function scanFail() {
	_READYTOSCAN = false;
	_SCANFAIL = true;
	_SCANNING = false;
	await setState(4);
	await updateStationsMetrics({message: 'User presence is false'});
  await sleep(1500);
  eventEmitter.emit('processexit');
	//eventEmitter.emit('ready');
}

/**
 * `STATE 0` = READY or IDLE
 * `STATE 1` = SCANNING
 * `STATE 2` = DONE
 * `STATE 3` = OUT OF LANTERN
 * `STATE 4` = ERROR FAILED (mainly because client presence is false while scanning)
 * `STATE 5` = Getting new user
 * `STATE 6` = BOOTING
 * `STATE 7` = CLICKED
 * `STATE 8` = REBOOT
 * `STATE 9` = USER LEFT
 * Set the state of the station
 * @return {Promise<axios>} return the current bpm value
 * @param {Number} id
 */
async function setState(id) {

	return new Promise(async (resolve, reject) => {
		await axios
			.put(`http://${IP}/api/stations/${ID}`, {state: id})
      .then(async () => {
        _CURENTSTATE = id;
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

/**
 * Start the BPM scan. When value is stable we launch the counter and return the last value
 * @return {Promise<number>} Last BPM after a certain time
 */
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
      return arr[key].presence === true;
    });
    _ALLUSER = isAllTrue
    resolve(_ALLUSER)
  }).catch((err) => {
    console.log('🚀 ~ file: server.js ~ line 57 ~ checkUsers ~ err', err);
  });
}

async function scan() {
  if (_ALLUSER === false || _DONE === true) { 
    return
  }
  //clearInterval(inter);
 // console.log("🚀 ~ file: index.js ~ line 384 ~ scan ~ inter", inter);
	timerInstance.addEventListener('secondsUpdated', async function (e) {
    console.log(timerInstance.getTimeValues().toString());
    await checkUsers();
    if (_PRESENCE === false || _ALLUSER === false) { eventEmitter.emit('presence/false') }
		await updateStationsMetrics({timer: timerInstance.getTimeValues().toString()});
	});
	timerInstance.addEventListener('targetAchieved', async function (e) {
		_READYTOSCAN = false;
		_DONE = true;
		_SCANNING = false;
		timerInstance.stop();
		await setLantern(_POLARBPM);
  });

 // await sleep(1000)
	await setState(1);
	_SCANNING = true;
	await updateStationsMetrics({message: 'Scanning...'});
	timerInstance.start({countdown: true, startValues: {seconds: _TIMERSCAN}});
}

/**
 * Check the BPM at his current state
 * @return {Promise<number>} return the current bpm value
 * @param {Number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function validate(value) {
	if (_PRESENCE && _POLARBPM > 0) {
		return true;
	} else {
		return false;
	}
}

function doomsday(command, callback) {
	exec(command, function (error, stdout, stderr) {
		callback(stdout);
	});
}

async function updateStationsMetrics(value) {
	return new Promise(async (resolve, reject) => {
		await axios
			.put(`http://${IP}/api/stations/${ID}`, value)
			.then(() => {
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

async function pingAPI() {
	var status = await isReachable(IP);
	if (status) {
		return true;
	} else {
		return false;
	}
}
