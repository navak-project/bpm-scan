import 'dotenv/config';
import mqtt from 'mqtt';
const {MQTTIP, ID} = process.env;

export function clientConnect() {
	let client;
	try {
    const host = MQTTIP;
		const port = '1883';
		client = mqtt.connect(`mqtt://${host}:${port}`);
    client.on('connect', function () {
      console.log(`🚀 ~ Connected to MQTT broker: mqtt://${host}:${port}`);
     console.log("🚀 ~ file: mqtt.js ~ line 14 ~ ID", ID);
      client.subscribe(`/station/${ID}/presence`);
      client.subscribe(`/station/${ID}/reboot`);
      client.publish(`/station/s001/test`, "test");
    });
	} catch (err) {
		console.log('🚀 ~ file: mqtt.js ~ line 39 ~ returnnewpromise ~ err', err);
	}
	return client;
}
