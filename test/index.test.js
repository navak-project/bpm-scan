//const connectToDevice = require('./index.test.js');

import { metricsReset } from './metrics.test.js';
test("Connect to device ", () => {
  expect(metricsReset()).toBe("Done");
});
