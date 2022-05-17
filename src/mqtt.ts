import 'dotenv/config';
import mqtt from 'mqtt';
import ip from 'ip';
const {MQTTIP, ID} = process.env;

export async function clientConnect() {
	let client :any;
	try {
    const host = MQTTIP;
    const port = '1883';
    client = mqtt.connect(`mqtt://${host}:${port}`);
    client.on('connect', async function () {
      console.log(`🚀 ~ Connected to MQTT broker: mqtt://${host}:${port}`);
      await client.subscribe(`/station/${ID}/presence`);
      await client.subscribe(`/station/${ID}/reboot`);
      console.log(`My IP is: ${ip.address()}`);
    });
	} catch (err) {
		console.log('🚀 ~ file: mqtt.js ~ line 39 ~ returnnewpromise ~ err', err);
	}
  return client;
}
