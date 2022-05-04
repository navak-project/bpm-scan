import { EventEmitter } from 'events';
export const eventEmitter = new EventEmitter();

eventEmitter.on('test', async () => {
  console.log("🚀 ~ file: events.js ~ line 6 ~ eventEmitter.on ~ test");
});