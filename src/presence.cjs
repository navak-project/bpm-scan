const { Gpio } = require('onoff');

let detection = false;
// set BCM 17 pin as 'input'
const switchIn = new Gpio('17', 'in', 'both', { debounceTimeout: 10 });
console.log("🚀 ~ file: presence.cjs ~ line 6 ~ switchIn", switchIn);
const ledOut = new Gpio('4', 'out');
// listen for pin voltage change

setInterval(() => {
    switchIn.readSync((err, value) => {
      console.log("🚀 ~ file: presence.cjs ~ line 11 ~ switchIn", value);
      if (err) {
        console.log(err);
      } else {
        if (value === 1) {
          detection = true;
        } else {
          detection = false;
        }
      }
    })
}, 1000);

switchIn.watch((err, value) => {
  detection = true;
  console.log("detection: " + detection);
  if (err) {
    console.log('Error', err);
  }
});
detection = false;