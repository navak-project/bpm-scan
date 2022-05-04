import { createBluetooth } from 'node-ble';
const { bluetooth } = createBluetooth();
import { metrics } from '../metrics.js';
import { eventEmitter } from '../events.js'

export class Polar {
  constructor(deviceToConnect, metricsStatus, metricsState, gattService, gattCharacteristic) {
    this.deviceToConnect = deviceToConnect;
    this.metricsStatus = metricsStatus;
    this.metricsState = metricsState;
    this.gattService = gattService;
    this.gattService = gattService;
    this.gattCharacteristic = gattCharacteristic;
  }

  async connect() {
    const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
        if (err) {
          await metrics({ [metricsStatus]: 'No bluetooth adapter' });
          await metrics({ [metricsState]: 4 });
          throw err;
        }
      });

      if (!(await adapter.isDiscovering())) {
        await adapter.startDiscovery();
      }
      console.log('Discovering device...');
      await metrics({ [metricsStatus]: 'Discovering device...' });
      await metrics({ [metricsState]: 1 });

    const device = await adapter.waitDevice(deviceToConnect).catch(async (err) => {
        if (err) {
          console.log(err);
          await metrics({ [metricsStatus]: 'No device' });
          await metrics({ [metricsState]: 4 });
          eventEmitter.emit('test');
          return;
        }
      });

      const macAdresss = await device.getAddress();
      const deviceName = await device.getName();

    try {
      console.log('Device:', macAdresss, deviceName);
      await device.connect();
      await metrics({ [metricsStatus]: 'Connecting to device...' });
      await metrics({ [metricsState]: 2 });
    } catch (err) {
      console.log('Device:', err.text);
      await metrics({ [metricsStatus]: err.text });
      eventEmitter.emit('test');
      return;
      }

      const gattServer = await device.gatt();
      const service = await gattServer.getPrimaryService(gattService);
      const _self = await service.getCharacteristic(gattCharacteristic);
      await _self.startNotifications();

      console.log('Connected!');
      eventEmitter.emit('connected');
      await metrics({ [metricsStatus]: `Connected: ${deviceName} : ${macAdresss}` });
      await metrics({ [metricsState]: 3 });

      device.on('disconnect', async function () {
        eventEmitter.emit('test');
        await _self.stopNotifications();
      });
      return _self;;
  }
}
