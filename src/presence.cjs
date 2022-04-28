const { Gpio } = require('onoff');
const mcpadc = require('mcp-spi-adc');
let detection = false;
let hasHand = false;
// set BCM 17 pin as 'input'
const switchIn = new Gpio('17', 'in', 'both');

const ledOut = new Gpio('4', 'out');
// listen for pin voltage change

const tempSensor = mcpadc.open(5, { speedHz: 20000 }, err => {
  if (err) throw err;

  setInterval(_ => {
    tempSensor.read((err, reading) => {
      if (err) throw err;

      console.log((reading.value * 3.3 - 0.5) * 100);
    });
  }, 1000);
});

switchIn.watch((err, value) => {
  console.log("🚀 ~ file: presence.cjs ~ line 12 ~ switchIn.watch ~ value", value);
  if (err) {
    console.log('Error', err);
  }
  detection = true;
  return
});

const blinkLed = _ => {
  detection = false;
  //detection = false;
  setTimeout(blinkLed, 1200);
  console.log("detection: " + detection);
};
blinkLed();
