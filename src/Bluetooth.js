import { EventEmitter } from 'events';
const eventEmitter = new EventEmitter();

//import { createBluetooth } from 'node-ble';

const { createBluetooth } = require('node-ble')
const { bluetooth, destroy } = createBluetooth()

import { metrics } from './metrics.js';

//const bluetooth = createBluetooth();

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
	} catch (err) {
		await metrics({message: err.text});
    eventEmitter.emit('disconnected');
		return;
	}

  console.log('Connected!');
	await metrics({message: 'Connected'});
  device.on('disc onnect', async function () {
    await metrics({ message: 'Disconnected' })
    eventEmitter.emit('disconnected');
	});

	const gattServer = await device.gatt();
	const service = await gattServer.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
	const heartrate = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
	await heartrate.startNotifications();

	return heartrate;
}