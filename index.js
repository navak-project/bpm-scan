import 'dotenv/config';
import io from '@pm2/io';
import mqtt from 'mqtt';
import {createBluetooth} from 'node-ble';
const {bluetooth, destroy} = createBluetooth();
import axios from 'axios';
import {Timer} from 'easytimer.js';
import {exec} from 'child_process';
import {clientConnect} from './mqtt.js';
const {client} = clientConnect();

var timerInstance = new Timer();

let _USERBPM;
let _USER;
let _HEARTRATE;
let _PRESENCE = false;
let readyToScan = true;
let _POLARBPM;
const _TIMERSCAN = 15

const {ID, GROUP, IP} = process.env;

client.on('error', function (err) {
	console.dir(err);
});

client.on('message', function (topic, message) {
	// message is Buffer
	let buff = message.toString();
	let value = JSON.parse(buff);
	let valueParse = JSON.parse(value.presence.toLowerCase());
	_PRESENCE = valueParse;
  presence.set(valueParse);
  if (presence && _POLARBPM > 0) { 
    startScan(valueParse);
  } else {
    await setState(4);
    reset();
  }
});

const state = io.metric({
	name: 'Scanning state',
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
	name: 'Lantern',
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

async function init() {
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
  
	console.log('got device', macAdresss, deviceName);
	polarName.set(polarName);

	try {
		await device.connect();
	} catch (err) {
		console.log('🚀 ~ file: index.js ~ line 135 ~ init ~ err', err);
		message.set(err.text);
		console.log('Will reboot bluetooth in 5 seconds...');
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

	await getUser();

}

async function getUser() {
  console.log('Getting user...');
  lantern.set(`Getting user...`);
	return new Promise(async function (resolve, reject) {
		try {
			_USER = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
      console.log(`Got User [${_USER.data.id}]`);
      lantern.set(`User [${_USER.data.id}]`);
      await setState(0);
      message.set('Ready to scan');
      state.set('Ready [0]');
      console.log('Ready');
			resolve();
		} catch (error) {
			console.log(error.response.data);
			catchError.set(error.response.data);
			await setState(3);
			state.set('No lantern [3]');
      message.set('No lantern');
      console.log('No lantern, will try to get a user in 5 seconds...');
			await sleep(5000);
			await getUser();
			//process.exit(0);
		}
	});
}

async function startScan(presence) {
	// make sure to wait to be sure someone is there and its stable
	// OR USE A PRESSUR SENSOR
	
		//if (readyToScan) {
			await setState(1);
			//_USER = await getRandomUser();
			_USERBPM = await scan();
			await axios.put(`http://${IP}/api/lanterns/${_USER.data.id}`, {pulse: _USERBPM});
			await axios.put(`http://${IP}/api/stations/${ID}`, {state: 2, rgb: _USER.data.rgb});
			//reset();
			//readyToScan = false;
			_HEARTRATE.stopNotifications();
			timerInstance.pause();
			state.set('Done [2]');
			message.set('Done, will get a new user in 5 seconds...');
      await sleep(5000);
      await getUser();
		//	process.exit(0);
		//}
	
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
	return new Promise(async (resolve, reject) => {
		await axios
			.put(`http://${IP}/api/stations/${ID}`, {state: id})
			.then(() => {
				state.set(id);
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

async function reset() {
  timerInstance.stop();
  timer.set(`${_TIMERSCAN}`)
	message.set('User presence is false, will reboot in 5 seconds...');
  await sleep(5000);
  await setState(0);
	// process.exit(0);
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
	//readyToScan = false;
	return new Promise(async (resolve, reject) => {
		let scanBPM;
		// await _HEARTRATE.startNotifications();
		timerInstance.addEventListener('secondsUpdated', async function (e) {
			timer.set(timerInstance.getTimeValues().toString());
			/*if (!_PRESENCE) {
				await setState(4);
				reset();
			}*/
		});
		timerInstance.addEventListener('targetAchieved', async function (e) {
			resolve(scanBPM);
		});

		_HEARTRATE.on('valuechanged', async (buffer) => {
			let json = JSON.stringify(buffer);
			let bpm = Math.max.apply(null, JSON.parse(json).data);
			polarBPM.set(bpm);
			console.log(bpm);
			if (bpm != 0 && _PRESENCE) {
				scanBPM = bpm;
				await setState(1);
				state.set('Scanning [1]');
				message.set('Scanning...');
        timerInstance.start({ countdown: true, startValues: { seconds: _TIMERSCAN}});
			}
		});
	});
}

function doomsday(command, callback) {
	exec(command, function (error, stdout, stderr) {
		//console.log("🚀 ~ file: index.js ~ line 265 ~ error", error);
		callback(stdout);
	});
}

init();
