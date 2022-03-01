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
      console.log('🚀 ~ Connected to MQTT broker');
      client.subscribe(`/station/${ID}/presence`);
      //presence.set(_PRESENCE);
    });
	} catch (err) {
		console.log('🚀 ~ file: mqtt.js ~ line 39 ~ returnnewpromise ~ err', err);
	}
	return {client};
}
