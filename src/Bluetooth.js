import 'dotenv/config';
import axios from 'axios';
import { eventEmitter } from '../index.js'
const { ID, IP,  MACADDRESS } = process.env;
import {createBluetooth} from 'node-ble';

const {bluetooth, destroy} = createBluetooth();

import {metrics} from './metrics.js';

export async function connectToDevice() {
	const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
		if (err) {
      await metrics({ polarStatus: 'No bluetooth adapter' });
      await metrics({ polarState: 4 });
			throw err;
		}
	});

	console.log('Discovering device...');
  await metrics({ polarStatus: 'Discovering device...' });
  await metrics({ polarState: 1 });

	if (!(await adapter.isDiscovering())) {
		await adapter.startDiscovery();
  }

	const device = await adapter.waitDevice(MACADDRESS).catch(async (err) => {
		if (err) {
			console.log(err);
      await metrics({ polarStatus: 'No device' });
      await metrics({ polarState: 4 });
			eventEmitter.emit('disconnected');
			return;
		}
	});

	const macAdresss = await device.getAddress();
	const deviceName = await device.getName();

	console.log('Device:', macAdresss, deviceName);

	try {
    await device.connect();
    await metrics({ polarStatus: 'Connecting to device...' });
    await metrics({ polarState: 2 });
	} catch (err) {
    await metrics({ polarStatus: err.text});
		eventEmitter.emit('disconnected');
		return;
	}

	const gattServer = await device.gatt();
	const service = await gattServer.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
	const heartrate = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
  await heartrate.startNotifications();
  
  console.log('Connected!');
  eventEmitter.emit('connected');
  await metrics({ polarStatus: `Connected: ${deviceName}:${macAdresss}` });
  await metrics({ polarState: 3 });
 // await axios.put(`http://${IP}/api/stations/${ID}`, { polarStatus: true });

  device.on('disconnect', async function () {
  //  await axios.put(`http://${IP}/api/stations/${ID}`, { polarStatus: false });
    eventEmitter.emit('disconnected');
    await heartrate.stopNotifications();
  });
	return heartrate;
}
