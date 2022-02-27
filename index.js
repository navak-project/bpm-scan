import 'dotenv/config';
import io from '@pm2/io';
import mqtt from 'mqtt';
import {createBluetooth} from 'node-ble';
const {bluetooth, destroy} = createBluetooth();
import axios from 'axios';
import { Timer } from 'easytimer.js';
import { exec } from 'child_process';
import {clientConnect} from './mqtt.js';
const {client} = clientConnect();

var timerInstance = new Timer();

let _USERBPM;
let _USER;
let _HEARTRATE;
let _PRESENCE = false;
let readyToScan = true;
let _POLARBPM;

const {ID, GROUP, IP, MQTTIP} = process.env;

client.on('error', function (err) {
	console.dir(err);
});

client.on('message', function (topic, message) {
	// message is Buffer
	console.log('🚀 ~ file: index.js ~ line 34 ~ message', message);
	let buff = message.toString();
	let value = JSON.parse(buff);
	let valueParse = JSON.parse(value.presence.toLowerCase());
	_PRESENCE = valueParse;
	presence.set(valueParse);
	event(valueParse);
});

const state = io.metric({
	name: 'Scanning state'
});

const polarBPM = io.metric({
	name: 'Polar BPM'
});

const presence = io.metric({
	name: 'User presence',
	default: false
});

const user = io.metric({
	name: 'The current selected lantern'
});

const timer = io.metric({
	name: 'The timer when the BPM is stable'
});

const catchError = io.metric({
	name: 'Catch error'
});

const message = io.metric({
  name: 'Global message',
  default: 'No message'
});

const polarMAC = io.metric({
	name: 'Polar Mac Adress'
});

const polarName = io.metric({
	name: 'Polar device name'
});

async function init() {
  presence.set(false);
  user.set(null)

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

	console.log('got device', macAdresss, deviceName);
	polarMAC.set(macAdresss);
	polarName.set(polarName);

 /* doomsday('sudo /sbin/shutdown -r now', function(callback){
      console.log(callback);
  });*/
  try {
    await device.connect();
  } catch (err) {
    console.log("🚀 ~ file: index.js ~ line 135 ~ init ~ err", err);
    
  }

  message.set('Connected');
  console.log('Connected!');

  device.on('disconnect', async function (val) {
    console.log(`Device disconnected. State: ${val.connected}`);
    console.log('Will reboot in 5 seconds...');
    await sleep(5000);
  //  process.exit(0);
    doomsday('sudo /sbin/shutdown -r now', function(callback){
        console.log(callback);
    });
  });
	const gattServer = await device.gatt();
	const service = await gattServer.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
	const heartrate = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
	await heartrate.startNotifications();

	_HEARTRATE = heartrate;
	//checkNotification();
	message.set('Waiting for notifications');

	_HEARTRATE.on('valuechanged', async (buffer) => {
		let json = JSON.stringify(buffer);
		let bpm = Math.max.apply(null, JSON.parse(json).data);
		_POLARBPM = bpm;
		polarBPM.set(bpm);
	});

	_USER = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`).catch(async function (error) {
		if (error) {
			console.log(error.response.data);
			catchError.set(error.response.data);
			await setState(3);
			state.set('No lantern [3]');
			await sleep(2000);
			process.exit(0);
		}
	});

	user.set(`User [${_USER.data.id}]`);
	await setState(0);
	message.set('Ready to scan');
	state.set('Ready [0]');
	console.log('Ready');
}

async function event(presence) {
	// make sure to wait to be sure someone is there and its stable
	// OR USE A PRESSUR SENSOR
	if (presence && _POLARBPM > 0) {
		if (readyToScan) {
			await setState(1);
			//_USER = await getRandomUser();
			_USERBPM = await scan();
			await axios.put(`http://${IP}/api/lanterns/${_USER.data.id}`, {pulse: _USERBPM});
			await axios.put(`http://${IP}/api/stations/${ID}`, {state: 2, rgb: _USER.data.rgb});
			//reset();
			readyToScan = false;
			_HEARTRATE.stopNotifications();
			timerInstance.pause();
      state.set('Done [2]');
      message.set('Done, will reboot in 5 seconds...');
      await sleep(5000);
			process.exit(0);
		}
	}
}

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
  console.log("🚀 ~ file: index.js ~ line 211 ~ setState ~ id", id);
  return new Promise(async (resolve, reject) => {
		await axios
			.put(`http://${IP}/api/stations/${ID}`, {state: id})
			.then(() => {
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

async function reset() {
	timerInstance.stop();
	process.exit(0);
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
/**
 * Start the BPM scan. When value is stable we launch the counter and return the last value
 * @return {Promise<number>} Last BPM after a certain time
 */
async function scan() {
	readyToScan = false;
	return new Promise(async (resolve, reject) => {
		let scanBPM;
		// await _HEARTRATE.startNotifications();
		timerInstance.addEventListener('secondsUpdated', async function (e) {
			timer.set(timerInstance.getTimeValues().toString());
			if (!_PRESENCE) {
				await setState(4);
				reset();
			}
		});
		timerInstance.addEventListener('targetAchieved', async function (e) {
			resolve(scanBPM);
		});

		_HEARTRATE.on('valuechanged', async (buffer) => {
			let json = JSON.stringify(buffer);
			let bpm = Math.max.apply(null, JSON.parse(json).data);
			polarBPM.set(bpm);
			console.log(bpm);
			if (bpm != 0) {
				scanBPM = bpm;
				await setState(1);
        state.set('Scanning [1]');
        message.set('Scanning...');
				timerInstance.start({countdown: true, startValues: {seconds: 15}});
			}
		});
	});
}

function doomsday(command, callback) {
  exec(command, function (error, stdout, stderr) { callback(stdout); });
}

init();
