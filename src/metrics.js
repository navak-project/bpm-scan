import axios from 'axios';
const { IP, ID } = process.env;

export async function metrics(value) {
  return new Promise(async (resolve, reject) => {
    await axios
      .put(`http://${IP}/api/stations/${ID}`, value)
      .then(() => {
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export async function metricsReset(value) {
  await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: '50, 50, 50, 255' });
  return new Promise(async (resolve, reject) => {
    const data = {
      "message": "-",
      "status": false,
      "lantern": "-",
      "timer": "00:00:15",
      "presence": "false",
      "state": parseInt('01101010 00101011 01101110', 24)
    }
    await axios
      .put(`http://${IP}/api/stations/${ID}`, data)
      .then(() => {
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}