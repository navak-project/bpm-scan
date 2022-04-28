//import { eventEmitter } from '../index.js'
const eventEmitter = require('../index.js')
const Gpio = require('onoff').Gpio;
const button = new Gpio(4, 'in', 'both');
let presence = false;
button.watch((err, value) => {
  console.log("🚀 ~ file: presence.js ~ line 5 ~ button.watch ~ value", value);
  eventEmitter.emit('presence/test', value);
});
export function getPresence() {
    button.watch((err, value) => {
      console.log("🚀 ~ file: presence.js ~ line 5 ~ button.watch ~ value", value);
      eventEmitter.emit('presence/test', value);
    });
  
  return presence
}
