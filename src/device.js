'use strict';

import {createBluetooth} from 'node-ble';
const {bluetooth} = createBluetooth();
import {metrics} from './metrics.js';
import {eventEmitter} from '../index.js';

export class ConnectionToDevice {
	constructor(deviceToConnect, metricsStatus, metricsState, gattService, gattCharacteristic, resetEmitter) {
		this.deviceToConnect = deviceToConnect;
		this.metricsStatus = metricsStatus;
		this.metricsState = metricsState;
		this.gattService = gattService;
		this.gattService = gattService;
		this.gattCharacteristic = gattCharacteristic;
		this.resetEmitter = resetEmitter;
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
					//eventEmitter.emit(this.resetEmitter);
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
				//eventEmitter.emit(this.resetEmitter);
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
				this.device = null;
				eventEmitter.emit(this.resetEmitter);
				console.log('Disconnect!');
			});

			// assign _self to the class in order to read it in the future
			// this._gattServer = device;
			this._device = _self;
			resolve(this._device);
		});
	}
}
