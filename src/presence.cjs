const { Gpio } = require('onoff');

let detection = false;
let hasHand = false;
// set BCM 17 pin as 'input'
const switchIn = new Gpio('7', 'in', 'both', { debounceTimeout: 2 });

const ledOut = new Gpio('4', 'out');
// listen for pin voltage change
setInterval(function () {
  console.log(switchIn.readSync() ^ 1);
}, 100);

switchIn.watch((err, value) => {
  console.log("🚀 ~ file: presence.cjs ~ line 12 ~ switchIn.watch ~ value", value);
  if (err) {
    console.log('Error', err);
  }
  if (value === 0) { 
    detection = true;
  } else {
    detection = false;
  }

  return
});

const blinkLed = _ => {
 
  //detection = false;
  setTimeout(blinkLed, 1200);
  console.log("detection: " + detection);
};
blinkLed();
