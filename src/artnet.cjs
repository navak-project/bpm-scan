// Load dmxnet as libary
require('dotenv').config();
var dmxlib = require('dmxnet');
const ws281x = require('@gbkwiatt/node-rpi-ws281x-native');

var dmxnet = new dmxlib.dmxnet();
var receiver = dmxnet.newReceiver({
	subnet: 15,
	universe: process.env.UNI1,
	net: 0
});

var receiver2 = dmxnet.newReceiver({
	subnet: 15,
	universe: process.env.UNI2,
	net: 0
});

const channel = ws281x(512, {
	dma: 10,
	freq: 800000,
	gpio: 21,
	invert: false,
	brightness: 255,
	stripType: ws281x.stripType.WS2812
});

receiver.on('data', function (data) {
	for (let i = 0; i < data.length / 3; i++) {
    channel.array[i] = rgb2Int(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
	}
});

receiver2.on('data', function (data) {
	for (let i = 0; i < data.length / 3; i++) {
		channel.array[i + 170] = rgb2Int(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
	}
});


setInterval(function () {
	ws281x.render();
}, 1000 / 60);

function rgb2Int(r, g, b) {
	return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
