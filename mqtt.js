import 'dotenv/config';
import mqtt from 'mqtt';
const {MQTTIP} = process.env;

export function clientConnect() {
	let client;
	try {
		const host = MQTTIP;
		const port = '1883';
		client = mqtt.connect(`mqtt://${host}:${port}`);
	} catch (err) {
		console.log('🚀 ~ file: mqtt.js ~ line 39 ~ returnnewpromise ~ err', err);
	}
	return {client};
}
