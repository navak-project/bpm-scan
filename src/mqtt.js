import 'dotenv/config';
import mqtt from 'mqtt';
const {MQTTIP, ID} = process.env;

export function clientConnect() {
	let Bclient;
	try {
    const host = MQTTIP;
    const port = '1883';
    Bclient = mqtt.connect(`mqtt://${host}:${port}`);
    Bclient.on('connect', function () {
      console.log(`🚀 ~ Connected to MQTT broker: mqtt://${host}:${port}`);
      Bclient.subscribe(`/station/+/presence`);
      Bclient.subscribe(`/station/+/reboot`);
    });
    Bclient.on('message', function (topic, payload) {
      console.log(topic)
    });

	} catch (err) {
		console.log('🚀 ~ file: mqtt.js ~ line 39 ~ returnnewpromise ~ err', err);
	}
	return Bclient;
}
