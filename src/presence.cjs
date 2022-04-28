const { Gpio } = require('onoff');

// set BCM 17 pin as 'input'
const switchIn = new Gpio('17', 'in', 'both');
const ledOut = new Gpio('4', 'out');
// listen for pin voltage change
switchIn.watch((err, value) => {
  if (err) {
    console.log('Error', err);
  }

  // write the input value (0 or 1) 'ledOut' pin
  ledOut.writeSync(value);
});