const { Gpio } = require('onoff');

let detection = false;
// set BCM 17 pin as 'input'
const switchIn = new Gpio('17', 'in', 'both', { debounceTimeout: 10 });
const ledOut = new Gpio('4', 'out');
// listen for pin voltage change
switchIn.read()
  .then((value) => {
    console.log(value);
  }).catch(err => console.log(err));

switchIn.watch((err, value) => {
  detection = true;
  console.log("detection: " + detection);
  if (err) {
    console.log('Error', err);
  }
});
console.log("🚀 ~ file: presence.cjs ~ line 20 ~ detection", detection);
detection = false;