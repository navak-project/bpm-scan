// Load dmxnet as libary
require('dotenv').config();
var dmxlib = require('dmxnet');
const ws281x = require('@gbkwiatt/node-rpi-ws281x-native');
//import ws281x from '@gbkwiatt/node-rpi-ws281x-native';
// Create new dmxnet instance

/*var dmxnet = new dmxlib.dmxnet({
	dma: 10,
	freq: 800000,
	gpio: 18,
	invert: false,
	brightness: 255,
	stripType: ws281x.stripType.WS2812
});

var dmxnet2 = new dmxlib.dmxnet({
	dma: 10,
	freq: 800000,
	gpio: 21,
	invert: false,
	brightness: 255,
	stripType: ws281x.stripType.WS2812
});*/

var dmxnet = new dmxlib.dmxnet();
//var dmxnet2 = new dmxlib.dmxnet();
// Create a new receiver instance, listening for universe 5 on net 0 subnet 0
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

// Create a new receiver instance, listening for universe 5 on net 0 subnet 0
/*var receiver3 = dmxnet.newReceiver({
	subnet: 15,
	universe: process.env.UNI1,
	net: 0
});

var receiver4 = dmxnet.newReceiver({
	subnet: 15,
	universe: process.env.UNI2,
	net: 0
});
*/
// ---- trap the SIGINT and reset before exit
/*process.on('SIGINT', function () {
    ws281x.reset();
    log.debug("Reseting Leds on exit...")
    process.nextTick(function () { process.exit(0); });
});*/

const channels = ws281x.init({
  dma: 10,
  freq: 800000,
  channels: [
    {count:512, gpio: 18, invert: false, brightness: 255, stripType: ws281x.stripType.WS2812 },
    { count: 512,  gpio: 21, invert: false, brightness: 255, stripType: ws281x.stripType.WS2812 }
  ]
});

/*const channel = ws281x(512, {
	dma: 10,
	freq: 800000,
	gpio: 18,
	invert: false,
	brightness: 255,
	stripType: ws281x.stripType.WS2812
});

const channel2 = ws281x(512, {
	dma: 10,
	freq: 800000,
	gpio: 21,
	invert: false,
	brightness: 255,
	stripType: ws281x.stripType.WS2812
});*/
//console.log("🚀 ~ file: artnet.cjs ~ line 83 ~ colors", colors);
//const colors2 = channel2.array;
  //await sleep(2000);
  channels[0].array[12] = 0xff0000;
  receiver.on('data', function (data) {
    for (let i = 0; i < data.length / 3; i++) {
      channels[0].array[i] = rgb2Int(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
      channels[1].array[i] = rgb2Int(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    }
    console.log("🚀 ~ file: artnet.cjs ~ line 97 ~ data", data);
  });

  receiver2.on('data', function (data) {
    for (let i = 0; i < data.length / 3; i++) {
      channels[0].array[i + 170] = rgb2Int(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
      channels[1].array[i + 170] = rgb2Int(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
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