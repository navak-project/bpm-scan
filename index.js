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

const timerInstance = new Timer();



let _DONE = false;
let _BOOTING = false;
let _USER;
let _HEARTRATE;
let _PRESENCE = false;
let _READYTOSCAN = false;
let _POLARBPM;
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
  if (_BOOTING) {return;}
	// message is Buffer
	let buff = message.toString();
	let value = JSON.parse(buff);
  _PRESENCE = JSON.parse(value.presence.toLowerCase());
  eventEmitter.emit('presence', _PRESENCE);
});



// listen to the event
eventEmitter.on('init', async () => {
  await init().then(() => {
    console.log('init done!');
    lantern.set(_USER.data.id);
  }).catch(async (err) => {
    console.log(err);
    await sleep(5000);
    console.log('init failed, will try again in 5 seconds...');
    eventEmitter.emit('init');
  });
});

// listen to the event
eventEmitter.on('ready', async () => {
  _READYTOSCAN = true;
  _DONE = false;
  if (validate()) {
    await sleep(2500);
    eventEmitter.emit('presence/true');
    return;
  }
  await setState(0);
  message.set('Ready to scan');
  console.log('Ready');
});

// listen to the event
eventEmitter.on('done', async () => {
  await setState(2);
  message.set('Done!');
  timer.set(_TIMERSCAN);
});

eventEmitter.on('presence/true', async () => {
  if (validate() && _READYTOSCAN) {await scan();}
});

eventEmitter.on('presence/false', async (value) => {
  if (_POLARBPM == 0) { return }
  timerInstance.stop();
  timer.set(_TIMERSCAN);
  if (_DONE == false && _READYTOSCAN) {
    scanFail()
  } else {
    done();
  }
});

// listen to the event
eventEmitter.on('presence', async (value) => {
  presence.set(_PRESENCE);
  if (value == true) {
    eventEmitter.emit('presence/true');
  }
  if (value == false) {
    eventEmitter.emit('presence/false');
  }
});


// BOOT
(async function () {
	// doomsday('sudo invoke-rc.d bluetooth restart', function (callback) { })
	// doomsday('sudo hostname -I', function (callback) { })
  _BOOTING = true;
	await setState(6);

	console.log('booting...');
	message.set('booting...');

	await sleep(3000);

	const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
    if (err) {
      await setState(4);
      console.log(err);
      console.log('No bluetooth adapter, will try to get one in 5 seconds...');
      message.set('No bluetooth adapter, will try to get one in 5 seconds...');
      await sleep(5000);
			process.exit(0);
		}
  });

  console.log('Discovering device...');
  message.set('Discovering device...');
  const isDiscovering = await adapter.isDiscovering().catch(async (err) => {
    console.log(err);
    await setState(4);
    console.log('No device, will try to get one in 5 seconds...');
    message.set('No device, will try to get one in 5 seconds...');
    await sleep(5000);
    process.exit(0);
  });

  if (!isDiscovering) {
		await adapter.startDiscovery();
	}

	const device = await adapter.waitDevice('A0:9E:1A:9F:0E:B4').catch(async (err) => {
		if (err) {
      console.log(err);
      await setState(4);
      console.log('No device, will try to get one in 5 seconds...');
			message.set('No device, will try to get one in 5 seconds...');
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
    if (bpm == 0) {
      bpm = 60;
    }
		_POLARBPM = bpm;
    polarBPM.set(bpm);
  });
  await sleep(5000);
  eventEmitter.emit('init');
})();

async function init() {
  _READYTOSCAN = false;
  await setState(5);
  console.log('Getting user...');
  await sleep(3000)
	return new Promise(async function (resolve, reject) {
		try {
			_USER = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
      eventEmitter.emit('ready');
      _BOOTING = false;
			resolve();
		} catch (error) {
			console.log(error.response.data);
			catchError.set(error.response.data);
			await setState(3);
			message.set('No lantern');
			console.log('No lantern, will try to get a user in 5 seconds...');
			await sleep(5000);
      reject();
		}
	});
}

async function setLantern(userBpm) {
  message.set('Setting lantern...');
  await axios.put(`http://${IP}/api/lanterns/${_USER.data.id}`, { pulse: userBpm });
  await axios.put(`http://${IP}/api/stations/${ID}`, { state: 2, rgb: _USER.data.rgb });
  eventEmitter.emit('done');
}

async function done() {
  await sleep(3000);
  eventEmitter.emit('init');
  message.set('User is done and left! Will restart 5 seconds...');
  //eventEmitter.emit('ready');
}
async function scanFail() {
  await setState(4);
  _READYTOSCAN = false;
  message.set('User presence is false, will restart in 5 seconds...');
  await sleep(5000);
  eventEmitter.emit('ready');
}

/**
 * `STATE 0` = READY or IDLE
 * `STATE 1` = SCANNING
 * `STATE 2` = DONE
 * `STATE 3` = OUT OF LANTERN
 * `STATE 4` = ERROR FAILED (mainly because client presence is false while scanning)
 * `STATE 5` = Getting new user
 * `STATE 6` = BOOTING
 * Set the state of the station
 * @return {Promise<axios>} return the current bpm value
 * @param {Number} id
 */
async function setState(id) {
	return new Promise(async (resolve, reject) => {
		await axios
			.put(`http://${IP}/api/stations/${ID}`, {state: id})
      .then(() => {
        state.set(toString(id));
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
async function scan() {
		timerInstance.addEventListener('secondsUpdated', async function (e) {
      timer.set(timerInstance.getTimeValues().toString());
      console.log(timerInstance.getTimeValues().toString());
		});
    timerInstance.addEventListener('targetAchieved', async function (e) {
      timerInstance.stop();
      _READYTOSCAN = false;
      _DONE = true;
      await setLantern(_POLARBPM)
    });
      await setState(1);
      message.set('Scanning...');
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
