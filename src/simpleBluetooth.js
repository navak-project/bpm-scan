import { createBluetooth } from 'node-ble';
const { bluetooth } = createBluetooth();

connectToDevice();
export async function connectToDevice() {
  const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
    if (err) {
      throw err;
    }
  });


  if (!(await adapter.isDiscovering())) {
    await adapter.startDiscovery();
  }

  console.log('Discovering device...');

  const device = await adapter.waitDevice('34:94:54:39:18:A6').catch(async (err) => {
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

  const gattServer = await device.gatt();
  const service = await gattServer.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
  const heartrate = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');
  await heartrate.startNotifications();

  console.log('Connected!');
  heartrate.on('valuechanged', async (buffer) => {
    let json = JSON.stringify(buffer);
    let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
    console.log("🚀 ~ file: simpleBluetooth.js ~ line 46 ~ heartrate.on ~ deviceHeartrate", deviceHeartrate);
  });

  device.on('disconnect', async function () {
    console.log("🚀 ~ file: simpleBluetooth.js ~ line 52 ~ disconnect", disconnect);
  });
  return heartrate;
}
