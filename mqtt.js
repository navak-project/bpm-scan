module.exports = () => {
	require('dotenv').config();
	var mqtt = require('mqtt');
	const {MQTT} = process.env;
  console.log("🚀 ~ file: mqtt.js ~ line 5 ~ MQTT", MQTT);
  const host = `${MQTT}`;
	const port = '1883';
	var client = mqtt.connect(`mqtt://${host}:${port}`);
	client.on('connect', function () {
		console.log(`Connected to MQTT: mqtt://${host}:${port}`);
	});
	return client;
};
