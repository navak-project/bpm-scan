'use strict';

import {createBluetooth} from 'node-ble';
const {bluetooth} = createBluetooth();
import {metrics} from './metrics.js';
export class ConnectionToDevice {
	constructor(deviceToConnect, metricsStatus, metricsState, gattService, gattCharacteristic) {
    console.log("🚀 ~ file: device.js ~ line 8 ~ ConnectionToDevice ~ constructor ~ deviceToConnect", deviceToConnect);
		this.deviceToConnect = deviceToConnect;
		this.metricsStatus = metricsStatus;
		this.metricsState = metricsState;
		this.gattService = gattService;
		this.gattService = gattService;
		this.gattCharacteristic = gattCharacteristic;
		this._device = null;
		this._gattServer = null;
	}

	get gattServer() {
		return this._gattServer;
	}

	get device() {
		return this._device;
	}

	set device(value) {
		this._device = value;
	}

  async connect() {
    var self = this;
		return new Promise(async (resolve, reject) => {
			const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
				if (err) {
					await metrics({[this.metricsStatus]: 'No bluetooth adapter'});
					await metrics({[this.metricsState]: 4});
					reject(err);
					//throw err;
				}
			});

			if (!(await adapter.isDiscovering())) {
				await adapter.startDiscovery();
			}
			console.log('Discovering device...');
			await metrics({[this.metricsStatus]: 'Discovering device...'});
			await metrics({[this.metricsState]: 1});

			const device = await adapter.waitDevice(this.deviceToConnect).catch(async (err) => {
				if (err) {
					console.log(err);
					await metrics({[this.metricsStatus]: 'No device'});
					await metrics({[this.metricsState]: 4});
					reject('No device');
					return;
				}
			});

			const macAdresss = await device.getAddress();
			const deviceName = await device.getName();

			try {
				console.log('Device:', macAdresss, deviceName);
				await device.connect();
				await metrics({[this.metricsStatus]: 'Connecting to device...'});
				await metrics({[this.metricsState]: 2});
			} catch (err) {
				console.log('Device:', err.text);
				await metrics({[this.metricsStatus]: err.text});
				reject(err.text);
				return;
			}

			const gattServer = await device.gatt();
			const service = await gattServer.getPrimaryService(this.gattService);
			const _self = await service.getCharacteristic(this.gattCharacteristic);
			await _self.startNotifications();

			console.log('Connected!');
			//eventEmitter.emit('connected');
			await metrics({[this.metricsStatus]: `Connected: ${deviceName} : ${macAdresss}`});
			await metrics({[this.metricsState]: 3});

			device.on('disconnect', async function () {
				await _self.stopNotifications();
        this._device = null;
        console.log(`Disconnected: ${deviceName} : ${macAdresss}`);
        self.connect();
			});

			this._device = _self;
			resolve(this._device);
		});
	}
}
