import { init } from 'raspi';
import { I2C } from 'raspi-i2c';

init(() => {
  const i2c = new I2C();
  console.log(i2c.readByteSync(0x18)); // Read one byte from the device at address 18
});