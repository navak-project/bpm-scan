import 'dotenv/config';
import axios from 'axios';
const { IP, ID } = process.env;
export async function metrics(value) {
    return new Promise(async (resolve, reject) => {
        await axios
            .put(`http://${IP}/api/stations/${ID}`, value)
            .then(() => {
            resolve('Metrics sent!');
        })
            .catch((err) => {
            reject(err);
        });
    });
}
export async function metricsReset() {
    await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: '50, 50, 50, 255' });
    return new Promise(async (resolve, reject) => {
        const data = {
            "message": "-",
            "status": false,
            "lantern": null,
            "timer": "00:00:15",
            "presence": "false",
            "state": 6,
            "polarStatus": "No device",
            "polarState": 4,
            "presenceStatus": "No device",
            "presenceState": 4,
        };
        await axios
            .put(`http://${IP}/api/stations/${ID}`, data)
            .then(() => {
            resolve('Metrics reset!');
        })
            .catch((err) => {
            reject(err);
        });
    });
}
//# sourceMappingURL=metrics.js.map