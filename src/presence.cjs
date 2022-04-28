const { Gpio } = require('onoff');

let detection = false;
// set BCM 17 pin as 'input'
const switchIn = new Gpio('17', 'in', 'both', { debounceTimeout: 10 });
console.log("🚀 ~ file: presence.cjs ~ line 6 ~ switchIn", switchIn);
const ledOut = new Gpio('4', 'out');
// listen for pin voltage change

const blinkLed = _ => {
  switchIn.read((err, value) => { // Asynchronous read
    if (err) {
      throw err;
    }

    switchIn.write(value ^ 1, err => { // Asynchronous write
      if (err) {
        throw err;
      }
    });
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