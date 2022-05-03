import { createBluetooth } from 'node-ble';
const { bluetooth } = createBluetooth();


export async function connectToDevice() {
  const adapter = await bluetooth.defaultAdapter().catch(async (err) => {
    if (err) {
      throw err;
    }
  });

  console.log('Discovering device...');

  if (!(await adapter.isDiscovering())) {
    await adapter.startDiscovery();
  }

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

  device.on('disconnect', async function () {
    //  await axios.put(`http://${IP}/api/stations/${ID}`, { polarStatus: false });
  });
    console.log("🚀 ~ file: simpleBluetooth.js ~ line 48 ~ disconnect");
  return heartrate;
}
