import { createBluetooth } from 'node-ble';
const { bluetooth } = createBluetooth();
import { metrics } from './src/metrics.js';
await test('34:94:54:39:18:A6','none', 'none');
await test('A0:9E:1A:9F:0E:B4', 'polarStatus', 'polarStatus')
async function test(deviceToConnect, metricsStatus, metricsState) {
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
  await metrics({ [metricsState]: 6 });
  const device = await adapter.waitDevice(deviceToConnect).catch(async (err) => {
    if (err) {
      console.log(err);
      return;
    }
  });

  const macAdresss = await device.getAddress();
  const deviceName = await device.getName();

  try {
    console.log('Device:', macAdresss, deviceName);
    await device.connect();
  } catch (err) {
    console.log('Device:', err.text);
    return;
  }
  device.on('disconnect', async function () {
    console.log("🚀 ~ file: test.js ~ line 39 ~ disconnect", deviceName);
  });
  console.log('Connected!')
}

