import axios from 'axios';
const { IP, ID } = process.env;
export async function metricsReset() {
  return new Promise(async (resolve, reject) => {
    const data = {
      'message': '-',
      'status': '-',
      'lantern': '-',
      'timer': '00:00:15',
      'presence': 'false',
    }
    await axios
      .put(`http://${IP}/api/stations/${ID}`, data)
      .then(() => {
        resolve('Done');
      })
      .catch((err) => {
        reject(err);
      });
  });
}