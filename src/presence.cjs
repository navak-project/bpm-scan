//import { eventEmitter } from '../index.js'
//const eventEmitter = require('../index.js')
const Gpio = require('onoff').Gpio;
var gpiop = require('rpi-gpio').promise;
//const button = new Gpio(4, 'in', 'rising');
console.log("🚀 ~ file: presence.cjs ~ line 5 ~ button", button);
let presence = false;

function alert() {
  console.log("detected !");
}

gpiop.on('change', function (channel, value) {
  console.log("🚀 ~ file: presence.cjs ~ line 17 ~ value", value);
  console.log("🚀 ~ file: presence.cjs ~ line 17 ~ channel", channel);
  //send monitoring data to server for monitor on site
});
gpiop.setup(4, gpiop.DIR_IN, gpiop.EDGE_BOTH, alert);
console.log("🚀 ~ file: presence.cjs ~ line 6 ~ presence", presence);
/*button.watch((err, value) => {
  console.log("🚀 ~ file: presence.js ~ line 5 ~ button.watch ~ value", value);
 // eventEmitter.emit('presence/test', value);
});*/
/*export function getPresence() {
    button.watch((err, value) => {
      console.log("🚀 ~ file: presence.js ~ line 5 ~ button.watch ~ value", value);
     // eventEmitter.emit('presence/test', value);
    });
  
  return presence
}*/
