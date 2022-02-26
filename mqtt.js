module.exports = () => {
	require('dotenv').config();
	var mqtt = require('mqtt');
	const {MQTT} = process.env;

	const host = `${MQTT}`;
  const port = '1883';
  console.log('🚀 ~ file: index.js ~ line 95 ~ init ~ port', port);
  console.log('🚀 ~ file: index.js ~ line 95 ~ init ~ host', host);

	var client = mqtt.connect(`mqtt://${host}:${port}`);
	client.on('connect', function (err) {
		if (err) {
			console.log('🚀 ~ file: index.js ~ line 97 ~ err', err);
			process.exit(0);
		}
		console.log(`Connected to MQTT: mqtt://${host}:${port}`);
	});
	return client;
};
