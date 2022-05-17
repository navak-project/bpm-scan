import 'dotenv/config';
const {ID, GROUP, IP, POLARMACADDRESS, PRESENCEMACADDRESS} = process.env;
import {metrics, metricsReset} from './src/metrics';
import {setState, getState} from './src/states';
import axios from 'axios';
import {clientConnect} from './src/mqtt';
import {ConnectionToDevice} from './src/device';
import isReachable from 'is-reachable';
import {Timer} from 'easytimer.js';
import {server} from './src/server';
import {EventEmitter} from 'events';
import './src/artnet';

let client : any;
let polarDevice : any;
let presenceDevice : any;
let timerScan : number;

let minDeviceValue : number;
let maxDeviceValue : number;
let timerInstance : any = null;
let timer : any = null;
let lantern : any = null;
let presence : boolean = false;
let alluser : boolean = false;
let heartrate : number = 0;
let _POLARDEVICE: any;
let _PRESENCEDEVICE : any;
let presenceFlag : boolean = false;
let togglePresenceMqtt : boolean = false;
let _deviceValue : number = 0;

export const eventEmitter = new EventEmitter();

client.on('error', function (err : any) {
	console.dir(err);
});

client.on('message', async function (topic : string, message : string) {
	let state = { name: await getState() };
	if (state.name === 'boot') {
		return;
	}
	if (topic === `/station/${ID}/reboot`) {
		await metrics({status: false});
		process.exit(0);
	}
	if (lantern !== null) {
		if (topic === `/${lantern.data.id}/status` || topic === `/lanterns/${lantern.data.id}/reset`) {
			await metrics({message: `Lantern ${lantern.data.id} offline`});
			await metrics({lantern: null});
			await axios.put(`http://${IP}/api/stations/${ID}`, {rgb: '50, 50, 50, 255', lantern: null});
			client.unsubscribe(`/${lantern.data.id}/status`);
			client.unsubscribe(`/lanterns/${lantern.data.id}/reset`);
			lantern = null;
			await getLantern();
		}
	}

	if (topic === `/station/${ID}/presence`) {
		let buff = message.toString();
		let value = JSON.parse(buff);
		presence = JSON.parse(value.presence.toLowerCase());
		togglePresenceMqtt = presence;
		await metrics({presence: presence});
		setPresence(presence);
	}
});

const removeListener = () => {
	console.log('Event removed!');
};

eventEmitter.on('connectToPolar', async () => {
	await polarDevice
		.connect()
		.then(async (device : any) => {
			_POLARDEVICE = device;
			_POLARDEVICE.on('valuechanged', async (buffer: any) => {
				let json = JSON.stringify(buffer);
				let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
				if (deviceHeartrate < 30 || deviceHeartrate > 180) {
					heartrate = randomIntFromInterval(70, 90);
					await metrics({bpm: heartrate});
					return;
				}
				heartrate = deviceHeartrate;
				await metrics({bpm: heartrate});
			});
		})
		.catch(async (error : any) => {
			console.log('🚀 ~ error:', error);
			await sleep(5000);
			eventEmitter.removeListener('connectToPolar', removeListener);
			eventEmitter.emit('connectToPolar');
		});
});

async function connectBluetooth(deviceToConnect : any) {
	try {
		await deviceToConnect.connect();
		return deviceToConnect.device;
	} catch (error : any) {
		console.log('🚀 ~ error', error);
		await sleep(5000);
		await connectBluetooth(deviceToConnect);
		return;
	}
}

async function ready() {
  await setState(0);
  await metrics({ message: 'Ready to scan' });
	/*if (presence) {
		setPresence(true);
		return;
	}*/

}

async function setPresence(val : boolean) {
	//if(lantern === null) { await getLantern(); }
	presence = val;
	if (val === true) {
		let state = { name: await getState() };
		await metrics({presence: true});
		if (presence && state.name === 'ready') {
			await setState(7);
			await metrics({message: 'User Ready, waiting'});
			while (!alluser) {
				await checkUsers();
			}
			if (alluser) {
				await sleep(1000);
				await scan();
			}
		}
	}
	if (val === false) {
		let state = { name: await getState() };
		await metrics({presence: false});
		alluser = false;
		if (state.name === 'scan' || state.name == 'outoflantern') {
			return;
		}
		if (state.name === 'done') {
			done();
			return;
		}
		ready();
	}
}

/*------------------------------------------------------*/

(async function () {
  client = await clientConnect();
  polarDevice= new ConnectionToDevice(POLARMACADDRESS, 'polarStatus', 'polarState', '0000180d-0000-1000-8000-00805f9b34fb', '00002a37-0000-1000-8000-00805f9b34fb');
  presenceDevice = new ConnectionToDevice(PRESENCEMACADDRESS, 'presenceStatus', 'presenceState', '4fafc201-1fb5-459e-8fcc-c5c9c331914b', 'beb5483e-36e1-4688-b7f5-ea07361b26a8');
  timerScan = 15;
	//await pingAPI();
	await metricsReset();
	await server();
	await setState(6);
	await metrics({message: 'Booting...'});
	await metrics({bpm: heartrate});

	_PRESENCEDEVICE = await connectBluetooth(presenceDevice);
  await getLantern();
  _PRESENCEDEVICE.on('valuechanged', async (buffer : any) => {
    await sleep(1000);
    if(lantern === null) { return; }
		let json = JSON.stringify(buffer);
		let deviceValue = Math.max.apply(null, JSON.parse(json).data);
		_deviceValue = deviceValue;
    if (deviceValue > 25 && deviceValue < 30 && !presenceFlag) {
			if (presence === true) {
				return;
			}
			presenceFlag = true;
      timer = new Timer();
      timer.addEventListener('secondsUpdated', function () {
        console.log(timer.getTimeValues().toString());
        if (_deviceValue > 35) {
          setPresence(false);
          presenceFlag = false;
          console.log('GOTTEM.. nothing happen', _deviceValue);
          timer = null;
          return;
        }
      });
      timer.addEventListener('targetAchieved', async function () {
        if (_deviceValue < 35) {
          setPresence(true);
          timer = null;
          return;
        }
      });
			timer.start({countdown: true, startValues: {seconds: 1}});
			console.log("There's a user...loading timer", _deviceValue);
			return;
		}
		if (deviceValue > 35 && presenceFlag) {
			if (presence === false) {
				return;
			}
			presenceFlag = false;
			setPresence(false);
			console.log('Presence false reseting timer');
      timer = null;
			return;
		}
		if (deviceValue > 35) {
      timer = null;
			if (togglePresenceMqtt === true) {
				return;
			}
			setPresence(false);
			return;
    }
 
	});
	console.log('Ready!');
})();

/*------------------------------------------------------*/

async function getLantern() {
  if(lantern !== null) { return; }
	await setState(5);
	await metrics({message: 'Getting Lantern...'});
	console.log('Getting Lantern...');
	try {
		await sleep(1000);
    lantern = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
    ready();
		client.subscribe(`/lanterns/${lantern.data.id}/reset`);
    client.subscribe(`/${lantern.data.id}/status`);
    await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: lantern.data.rgb });
    await metrics({ lantern: lantern.data.id });
    console.log(`Got: ${lantern.data.id}`);
	} catch (error : any) {
		await setState(3);
		await metrics({message: error.response.data});
		console.log(error.response.data);
		await axios.put(`http://${IP}/api/stations/${ID}`, {rgb: '50, 50, 50, 255', lantern: null});
		await sleep(2000);
		await metrics({message: 'Retrying...'});
		await sleep(4000);
		await getLantern();
	}
}

async function done() {
	await metrics({message: 'User is done and left!'});
	timerInstance = null;
	await metrics({timer: `00:00:${timerScan}`});
  await sleep(10000);
  await setState(9);
  await sleep(5000);
  process.exit(0);
}

async function getStations() {
	return new Promise(async (resolve, reject) => {
		await axios
			.get(`http://${IP}/api/stations/`)
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
		let arr : any = await getStations();
		var isAllTrue = Object.keys(arr).every(function (key : any) {
			if (arr[key].presence === true && arr[key].lantern != null) return true;
		});
		alluser = isAllTrue;
		resolve(alluser);
	}).catch((err) => {
		throw new Error(err);
	});
}

async function scan() {
	timerInstance = new Timer();
	timerInstance.addEventListener('secondsUpdated', async function () {
		await metrics({timer: timerInstance.getTimeValues().toString()});
		if (_POLARDEVICE === null) {
			heartrate = randomIntFromInterval(70, 90);
			await metrics({bpm: heartrate});
		}
	});
	timerInstance.addEventListener('targetAchieved', async function () {
		timerInstance.stop();
		await axios.put(`http://${IP}/api/lanterns/${lantern.data.id}`, {pulse: heartrate});
		await setState(2);
		client.publish(`/lantern/${lantern.id}/audio/ignite`, 'ignite');
		client.unsubscribe(`/${lantern.data.id}/status`);
		client.unsubscribe(`/lanterns/${lantern.data.id}/reset`);
		await metrics({lantern: null});
		lantern = null;
		await metrics({message: 'Done!'});
		if (!presence) {
			done();
			return;
		}
	});
	await setState(1);
	await metrics({message: 'Scanning...'});
	timerInstance.start({countdown: true, startValues: {seconds: timerScan}});
}

function sleep(ms : number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function randomIntFromInterval(min : number, max : number) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

/*async function pingAPI() {
	return new Promise(async (resolve, reject) => {
		var status = await isReachable(IP);
		if (status) {
			resolve(true);
		} else {
			console.log(`API: ${status}`)
			console.log('Retrying...')
			await sleep(4000);
			await pingAPI();
		}
	});
}*/