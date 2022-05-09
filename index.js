// when lantern reset, reset the station also by mqtt
// also if lantern crash, ping status if false, then reset the station

import 'dotenv/config';
const { ID, GROUP, IP, POLARMACADDRESS, PRESENCEMACADDRESS } = process.env;
import { metrics, metricsReset } from './src/metrics.js';
import { setState, getState } from './src/states.js';
import axios from 'axios';
import { clientConnect } from './src/mqtt.js';
import { ConnectionToDevice } from './src/device.js';
import isReachable from 'is-reachable';
import { Timer } from 'easytimer.js';
const timerInstance = new Timer();
import { server } from './src/server.js';
import { EventEmitter } from 'events';
export const eventEmitter = new EventEmitter();
import './src/artnet.cjs';

const client = await clientConnect();
const polarDevice = new ConnectionToDevice(POLARMACADDRESS, 'polarStatus', 'polarState', '0000180d-0000-1000-8000-00805f9b34fb', '00002a37-0000-1000-8000-00805f9b34fb');
const presenceDevice = new ConnectionToDevice(PRESENCEMACADDRESS, 'presenceStatus', 'presenceState', '4fafc201-1fb5-459e-8fcc-c5c9c331914b', 'beb5483e-36e1-4688-b7f5-ea07361b26a8');
const timerScan = 15;

let lantern = null;
let presence = false;
let alluser = false;
let heartrate = 0;
let _POLARDEVICE = null;
let _PRESENCEDEVICE = null;
let presenceFlag = false;
let togglePresenceMqtt = false;
let _deviceValue = 0;

client.on('error', function (err) {
  console.dir(err);
});

client.on('message', async function (topic, message) {
  console.log(topic);
  let state = await getState();
  if (state.name === 'boot') {
    return;
  }
  if (topic === `/station/${ID}/reboot`) {
    await metrics({ status: false });
    process.exit(0);
  }
  if (lantern !== null) {
    if (topic === `/${lantern.data.id}/status` || topic === `/lanterns/${lantern.data.id}/reset`) {
      await metrics({ message: `Lantern ${lantern.data.id} offline` });
      await metrics({ lantern: null });
      await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: '50, 50, 50, 255', lantern: null });
      client.unsubscribe(`/${lantern.data.id}/status`);
      client.unsubscribe(`/lanterns/${lantern.data.id}/reset`);
      sleep(2000);
      lantern = null;
      await getLantern();
    }
  }

  if (topic === `/station/${ID}/presence`) {
    let buff = message.toString();
    let value = JSON.parse(buff);
    presence = JSON.parse(value.presence.toLowerCase());
    togglePresenceMqtt = presence;
    await metrics({ presence: presence });
    setPresence(presence);
   
  }
});

const removeListener = () => {
  console.log('Event removed!')
}

eventEmitter.on('connectToPolar', async () => {
  await polarDevice
    .connect()
    .then(async (device) => {
      _POLARDEVICE = device;
      _POLARDEVICE.on('valuechanged', async (buffer) => {
        let json = JSON.stringify(buffer);
        let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
        if (deviceHeartrate < 30 || deviceHeartrate > 180) {
          heartrate = randomIntFromInterval(70, 90);
          await metrics({ bpm: heartrate });
          return;
        }
        heartrate = deviceHeartrate;
        await metrics({ bpm: heartrate });
      });
    })
    .catch(async (error) => {
      console.log('🚀 ~ error:', error);
      await sleep(5000);
      eventEmitter.removeListener('connectToPolar', removeListener)
      eventEmitter.emit('connectToPolar');
    });
});

async function connectBluetooth(deviceToConnect) {
  try {
    await deviceToConnect.connect();
    return deviceToConnect.device;
  } catch (error) {
    console.log('🚀 ~ error', error);
    await sleep(5000);
    await connectBluetooth(deviceToConnect);
    return;
  }
}

async function ready() {
  await setState(0);
  if (presence) {
    setPresence(true);
    return;
  }
  await metrics({ message: 'Ready to scan' });
}

eventEmitter.on('done', async () => {
  await setState(2);
  client.publish(`/lantern/${lantern.id}/audio/ignite`);
  await metrics({ lantern: null });
  lantern = null;
  if (!presence) {
    done();
    return;
  }
  await metrics({ message: 'Done!' });
});


async function setPresence(val) {
  presence = val;
  if (val === true) {
    let state = await getState();
    await metrics({ presence: true });
    if (presence && state.name === 'ready') {
      await setState(7);
      await metrics({ message: 'User Ready, waiting' });
      //while (!alluser) {
      //  await checkUsers();
      //}
    //  if (alluser) {
        await scan();
     // }
    }
  }
  if (val === false) {
    let state = await getState();
    await metrics({ presence: false });
    alluser = false;
    if (state.name === 'scan' || state.name == 'outoflantern') {
      return;
    }
    if (state.name === 'done') {
      done();
      return;
    }
    ready();
  }
}

/*------------------------------------------------------*/
var timer = new Timer();
timer.addEventListener('secondsUpdated', function (e) {
  console.log(timer.getTimeValues().toString())
  if (_deviceValue > 35) {
    timer.stop();
    presenceFlag = false
    setPresence(false)
    console.log('GOTTEM.. nothing happen', _deviceValue)
    return
  }
});
timer.addEventListener('targetAchieved', async function (e) {
  timer.stop();
  setPresence(true);
});

(async function () {
  // await pingAPI();
  //await pingAPI();
  await server();
  await metricsReset();
  await setState(6);
  await metrics({ message: 'Booting...' });
  await metrics({ bpm: heartrate });

  _PRESENCEDEVICE = await connectBluetooth(presenceDevice);
  _PRESENCEDEVICE.on('valuechanged', async (buffer) => {
    let json = JSON.stringify(buffer);
    let deviceValue = Math.max.apply(null, JSON.parse(json).data);
    _deviceValue = deviceValue
    if (deviceValue < 30 && deviceValue > 25 && !presenceFlag) {
      if (presence === true) { return }
      presenceFlag = true;
      timer.stop();
      timer.start({ countdown: true, startValues: { seconds: 1 } });
      console.log("There's a user...loading timer", _deviceValue)
      return
    }
    if (deviceValue > 35 && presenceFlag) {
      if (presence === false) { return }
      presenceFlag = false;
      setPresence(false);
      console.log('Presence false reseting timer')
      timer.stop();
      return
    }
    if (deviceValue > 35) { 
      timer.stop();
      if (togglePresenceMqtt === true) { return }
      setPresence(false);
      return
    }
  });

  await getLantern();
  console.log('Ready!');
})();

/*------------------------------------------------------*/

async function getLantern() {
  await setState(5);
  return new Promise(async function (resolve, reject) {
    try {
      lantern = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
      await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: lantern.data.rgb });
      ready();
      client.subscribe(`/lanterns/${lantern.data.id}/reset`);
      client.subscribe(`/${lantern.data.id}/status`);
      await metrics({ lantern: lantern.data.id });
      resolve(lantern.data.id);
    } catch (error) {
      await setState(3);
      await metrics({ message: error.response.data });
      await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: '50, 50, 50, 255', lantern: null });
      await sleep(3000);
      await metrics({ message: 'Retrying...' });
      await sleep(3000);
      await getLantern();
    }
  });
}

async function done() {
  await metrics({ message: 'User is done and left!' });
  await metrics({ timer: `00:00:${timerScan}` });
  await setState(9);
  await sleep(18000);
  await getLantern();
}

async function getStations() {
  return new Promise(async (resolve, reject) => {
    await axios
      .get(`http://${IP}/api/stations/`)
      .then((val) => {
        resolve(val.data);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

async function checkUsers() {
  return new Promise(async (resolve, reject) => {
    let arr = await getStations();
    var isAllTrue = Object.keys(arr).every(function (key) {
      if (arr[key].presence === true && arr[key].lantern != null) return true;
    });
    alluser = isAllTrue;
    resolve(alluser);
  }).catch((err) => {
    reject(err);
  });
}

async function scan() {
  timerInstance.addEventListener('secondsUpdated', async function (e) {
    await metrics({ timer: timerInstance.getTimeValues().toString() });
    if (_POLARDEVICE === null) {
      heartrate = randomIntFromInterval(70, 90);
      await metrics({ bpm: heartrate });
    }
  });
  timerInstance.addEventListener('targetAchieved', async function (e) {
    timerInstance.stop();
    await axios.put(`http://${IP}/api/lanterns/${lantern.data.id}`, { pulse: heartrate });
    eventEmitter.emit('done');
  });
  await setState(1);
  await metrics({ message: 'Scanning...' });

  timerInstance.start({ countdown: true, startValues: { seconds: timerScan } });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function pingAPI() {
  return new Promise(async (resolve, reject) => {
    var status = await isReachable(IP)
    if (status) {
      resolve(true)
    } else {
      //  console.log(`API: ${status}`)
      // console.log('Retrying...')
      // await sleep(1000);
      await pingAPI();
      //  reject(false)
    }
  })
}

function per(num, amount) {
  return num + (num * amount / 100);
}
function less(num, amount) {
  return num - (num * amount / 100);
}
