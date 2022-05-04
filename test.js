import { createBluetooth } from 'node-ble';
const { bluetooth } = createBluetooth();
import { metrics } from './src/metrics.js';
import { eventEmitter } from './src/events.js'
import { Polar } from './src/devices/polar.js';


// await connectToDevice(
//   '34:94:54:39:18:A6',
//   'presenceStatus',
//   'presenceState',
//   '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
//   'beb5483e-36e1-4688-b7f5-ea07361b26a8'
// );
// await connectToDevice(
//   'A0:9E:1A:9F:0E:B4',
//   'polarStatus',
//   'polarState',
//   '0000180d-0000-1000-8000-00805f9b34fb',
//   '00002a37-0000-1000-8000-00805f9b34fb');
async function coTest() {
  const polar = await new Polar('A0:9E:1A:9F:0E:B4',
  'polarStatus',
  'polarState',
  '0000180d-0000-1000-8000-00805f9b34fb',
    '00002a37-0000-1000-8000-00805f9b34fb').connect();

  console.log("🚀 ~ file: test.js ~ line 29 ~ connectToDevice ~ polar", polar.device);
}
coTest();
async function connectToDevice(deviceToConnect, metricsStatus, metricsState, gattService, gattCharacteristic) {

  return
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
  return _self;
}

