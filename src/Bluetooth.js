import 'dotenv/config';
import { EventEmitter } from 'events';
import axios from 'axios';
//const eventEmitter = new EventEmitter();
import { eventEmitter } from '../index.js'
const { ID, IP } = process.env;
import {createBluetooth} from 'node-ble';

const {bluetooth, destroy} = createBluetooth();

import {metrics} from './metrics.js';

export async function connectToDevice() {
	const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
		if (err) {
			await metrics({message: 'No bluetooth adapter'});
			throw err;
		}
	});

	console.log('Discovering device...');
	await metrics({message: 'Discovering device...'});

	if (!(await adapter.isDiscovering())) {
		await adapter.startDiscovery();
	}

	const device = await adapter.waitDevice('A0:9E:1A:9F:0E:B4').catch(async (err) => {
		if (err) {
			console.log(err);
			await metrics({message: 'No device'});
			eventEmitter.emit('disconnected');
			return;
		}
	});

	const macAdresss = await device.getAddress();
	const deviceName = await device.getName();

	console.log('Device:', macAdresss, deviceName);

	try {
    await device.connect();
    await metrics({ message: 'Connecting to device...' });
	} catch (err) {
		await metrics({message: err.text});
		eventEmitter.emit('disconnected');
		return;
	}


  device.on('disconnect', async function () {
    await axios.put(`http://${IP}/api/stations/${ID}`, { polarStatus: false });
    eventEmitter.emit('disconnected');
	});

	const gattServer = await device.gatt();
	const service = await gattServer.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
	const heartrate = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
  await heartrate.startNotifications();
  
  console.log('Connected!');
  await metrics({ message: 'Connected' });
  await axios.put(`http://${IP}/api/stations/${ID}`, { polarStatus: true });

	return heartrate;
}
