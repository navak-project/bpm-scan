import 'dotenv/config';
import io from '@pm2/io';
import {createBluetooth} from 'node-ble';
const {bluetooth} = createBluetooth();
import axios from 'axios';
import {Timer} from 'easytimer.js';
import {exec} from 'child_process';
import {clientConnect} from './mqtt.js';
const {client} = clientConnect();
import { EventEmitter } from 'events';
const eventEmitter = new EventEmitter();
var timerInstance = new Timer();



let _DONE =false;
let _USERBPM;
let _USER;
let _HEARTRATE;
let _PRESENCE = false;
let _READYTOSCAN = false;
let _SCANNING = false;
let _POLARBPM;
let _SCANDONE = false;
const _TIMERSCAN = 15;
const {ID, GROUP, IP} = process.env;

let firstData = false;

const state = io.metric({
	name: 'Scanning state'
});

const polarBPM = io.metric({
	name: 'Polar BPM',
	default: 0
});

const presence = io.metric({
	name: 'User presence',
	default: false
});

const lantern = io.metric({
	name: 'Lantern'
});

const timer = io.metric({
	name: 'The timer when the BPM is stable',
	default: `${_TIMERSCAN}`
});

const catchError = io.metric({
	name: 'Catch error'
});

const message = io.metric({
	name: 'Global message',
	default: 'No message'
});

const polarName = io.metric({
	name: 'Polar device name'
});

client.on('error', function (err) {
	console.dir(err);
});

client.on('message', async function (topic, message) {
	// message is Buffer
	let buff = message.toString();
	let value = JSON.parse(buff);
  _PRESENCE = JSON.parse(value.presence.toLowerCase());
  eventEmitter.emit('presence', _PRESENCE);
  /*if (!_SCANNING) {
	  checkScan(_PRESENCE);
  }*/
});



// listen to the event
eventEmitter.on('init', async () => {
  await init().then(() => {
    console.log('init done!');
  }).catch((err) => {
    console.log(err);
    sleep(5000);
    console.log('init failed, will try again in 5 seconds...');
    eventEmitter.emit('init');
  });
});

// listen to the event
eventEmitter.on('ready', async () => {
  await setState(0);
  message.set('Ready to scan');
  state.set('Ready 0');
  console.log('Ready');
  _READYTOSCAN = true;
});

// listen to the event
eventEmitter.on('done', async () => {
    await setState(2);
    state.set('Done 2');
    timer.set(_TIMERSCAN);
  message.set('Done!');
  _DONE = true;
});

// listen to the event
eventEmitter.on('presence', async (value) => {
  console.log("🚀 ~ file: index.js ~ line 115 ~ eventEmitter.on ~ value", value);
  presence.set(_PRESENCE);
  if (value == true) {
    if(_POLARBPM > 0) {
      await scan();
    }
  }
  if (value == false) {
    if (_DONE == false) {
      scanFail()
    } else {
      done();
    }
  }
});


// BOOT
(async function () {
	// doomsday('sudo invoke-rc.d bluetooth restart', function (callback) { })
	// doomsday('sudo hostname -I', function (callback) { })

	await setState(5);

	console.log('booting...');
	message.set('booting...');

	await sleep(3000);

	const adapter = await bluetooth.defaultAdapter().catch((err) => {
		if (err) {
			console.log(err);
			process.exit(0);
		}
	});

	if (!(await adapter.isDiscovering())) {
		await adapter.startDiscovery();
	}

	console.log('Discovering device...');
	message.set('Discovering device...');

	const device = await adapter.waitDevice('A0:9E:1A:9F:0E:B4').catch(async (err) => {
		if (err) {
			console.log(err);
			console.log('Will reboot in 5 seconds...');
			await sleep(5000);
			process.exit(0);
		}
	});

	const macAdresss = await device.getAddress();
	const deviceName = await device.getName();

	console.log('Device:', macAdresss, deviceName);
	polarName.set(polarName);

	try {
		await device.connect();
	} catch (err) {
		console.log('🚀 ~ file: index.js ~ line 135 ~ init ~ err', err);
		message.set(err.text);
		console.log('Will reboot in 5 seconds...');
		await sleep(5000);
		process.exit(0);
	}

	message.set('Connected');
	console.log('Connected!');

	device.on('disconnect', async function (val) {
		console.log(`Device disconnected. State: ${val.connected}`);
		console.log('Will reboot in 5 seconds...');
		await sleep(5000);
		process.exit(0);
	});

	const gattServer = await device.gatt();
	const service = await gattServer.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
	const heartrate = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
	await heartrate.startNotifications();

	_HEARTRATE = heartrate;
	_HEARTRATE.on('valuechanged', async (buffer) => {
		let json = JSON.stringify(buffer);
		let bpm = Math.max.apply(null, JSON.parse(json).data);
		_POLARBPM = bpm;
		polarBPM.set(bpm);
  });
  
  eventEmitter.emit('init');
})();

async function init() {
  await setState(5);
	console.log('Getting user...');
	return new Promise(async function (resolve, reject) {
		try {
			_USER = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
			console.log(`Got User [${_USER.data.id}]`);
			lantern.set(`User ${_USER.data.id}`);
      eventEmitter.emit('ready');
			resolve();
		} catch (error) {
			console.log(error.response.data);
			catchError.set(error.response.data);
			await setState(3);
			state.set('No lantern 3');
			message.set('No lantern');
			console.log('No lantern, will try to get a user in 5 seconds...');
			await sleep(5000);
      reject();
		}
	});
}

async function setLantern(userBpm) {
    await axios.put(`http://${IP}/api/lanterns/${_USER.data.id}`, { pulse: _USERBPM });
  await axios.put(`http://${IP}/api/stations/${ID}`, { state: 2, rgb: _USER.data.rgb });
  eventEmitter.emit('done');

}

async function done() {
  _READYTOSCAN = false;
  _SCANNING = false;
  timerInstance.stop();
  timer.set(_TIMERSCAN);
  message.set('User presence is false, will restart in 5 seconds...');
  await sleep(5000);
  _READYTOSCAN = true;
  _DONE = false;
  await setState(0);
  message.set('Ready to scan');
}

/*async function checkScan(presence) {
  if (_READYTOSCAN) {
    if (presence && _POLARBPM > 0) {
      _USERBPM = await scan();
      
      await axios.put(`http://${IP}/api/lanterns/${_USER.data.id}`, { pulse: _USERBPM });
      await axios.put(`http://${IP}/api/stations/${ID}`, { state: 2, rgb: _USER.data.rgb });
      await setState(2);
      state.set('Done 2');
      timer.set(_TIMERSCAN);
      message.set('Done!');
      _SCANDONE = true;
      if (presence == false && _SCANNING == false) {
        message.set('User left, will get a new user in 10 seconds...');
        await sleep(10000);
        await init();
      }
    } 
  }

}*/

/**
 * `STATE 0` = READY or IDLE
 * `STATE 1` = SCANNING
 * `STATE 2` = DONE
 * `STATE 3` = OUT OF LANTERN
 * `STATE 4` = ERROR FAILED (mainly because client presence is false while scanning)
 * `STATE 5` = BOOTING
 * Set the state of the station
 * @return {Promise<axios>} return the current bpm value
 * @param {Number} id
 */
async function setState(id) {
	return new Promise(async (resolve, reject) => {
		await axios
			.put(`http://${IP}/api/stations/${ID}`, {state: id})
			.then(() => {
				//state.set(id);
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

async function scanFail() {
  _READYTOSCAN = false;
  _SCANNING = false;
	timerInstance.stop();
	timer.set(_TIMERSCAN);
	message.set('User presence is false, will restart in 5 seconds...');
	await sleep(5000);
	_READYTOSCAN = true;
	await setState(0);
	message.set('Ready to scan');
}

/**
 * Start the BPM scan. When value is stable we launch the counter and return the last value
 * @return {Promise<number>} Last BPM after a certain time
 */
async function scan() {
	//return new Promise(async (resolve, reject) => {
		let userBpm;
		timerInstance.addEventListener('secondsUpdated', async function (e) {
      timer.set(timerInstance.getTimeValues().toString());
      console.log(timerInstance.getTimeValues().toString());
			if (!_PRESENCE || _POLARBPM === 0) {
			//	await setState(4);
			//	reset();
			}
		});
    timerInstance.addEventListener('targetAchieved', async function (e) {
      timerInstance.stop();
      userBpm = _POLARBPM;
      await setLantern(userBpm)
      _SCANNING = false;
     // resolve(userBpm);
    });
      _SCANNING = true;
  await setState(1);
      state.set('Scanning 1');
      message.set('Scanning...');
      timerInstance.start({countdown: true, startValues: {seconds: _TIMERSCAN}});
	//});
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

function doomsday(command, callback) {
	exec(command, function (error, stdout, stderr) {
		callback(stdout);
	});
}
