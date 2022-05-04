import { createBluetooth } from 'node-ble';
const { bluetooth } = createBluetooth();
test('34:94:54:39:18:A6')
test('A0:9E:1A:9F:0E:B4')
async function test(deviceToConnect, metricsStatus, metricsState) {
  const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
    if (err) {
      throw err;
    }
  });

  if (!(await adapter.isDiscovering())) {
    await adapter.startDiscovery();
  }
  console.log('Discovering device...');

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
  console.log('Connected!')
}

