const { Gpio } = require('onoff');

let detection = false;
// set BCM 17 pin as 'input'
const switchIn = new Gpio('17', 'in', 'both', { debounceTimeout: 10 });

const ledOut = new Gpio('4', 'out');
// listen for pin voltage change

const blinkLed = _ => {
  console.log(" ~ blinkLed");
  switchIn.read((err, value) => { // Asynchronous read
    console.log("🚀 ~ file: presence.cjs ~ line 13 ~ switchIn.read ~ value", value);
    if (err) {
      throw err;
    }
  });

  setTimeout(blinkLed, 1200);
};
blinkLed();
switchIn.watch((err, value) => {
  detection = true;
  console.log("detection: " + detection);
  if (err) {
    console.log('Error', err);
  }
});
detection = false;