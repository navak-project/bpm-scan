const { Gpio } = require('onoff');

// set BCM 17 pin as 'input'
const switchIn = new Gpio('17', 'in', 'rising', { debounceTimeout: 10 });
const ledOut = new Gpio('4', 'out');
// listen for pin voltage change
switchIn.read()
  .then((value) => {
    console.log(value);
  }).catch(err => console.log(err));

switchIn.watch((err, value) => {
  console.log("🚀 ~ file: presence.cjs ~ line 8 ~ switchIn.watch ~ value", value);
  if (err) {
    console.log('Error', err);
  }

  // write the input value (0 or 1) 'ledOut' pin
  ledOut.writeSync(value);
});