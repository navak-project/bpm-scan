import axios from 'axios';
const {IP, ID} = process.env;
/**
 * `STATE 0` = READY or IDLE
 * `STATE 1` = SCANNING
 * `STATE 2` = DONE
 * `STATE 3` = OUT OF LANTERN
 * `STATE 4` = ERROR FAILED (mainly because client presence is false while scanning)
 * `STATE 5` = Getting new user
 * `STATE 6` = BOOTING
 * `STATE 7` = CLICKED
 * `STATE 8` = REBOOT
 * `STATE 9` = USER LEFT
 * Set the state of the station
 * @return {Promise<axios>} return the current bpm value
 * @param {Number} id
 */
export async function setState(id) {
	let name = null;
	switch (id) {
		case 0:
			name = 'ready';
			break;
		case 1:
			name = 'scan';
			break;
		case 2:
			name = 'done';
			break;
		case 3:
			name = 'outoflantern';
			break;
		case 4:
			name = 'error';
			break;
		case 5:
			name = 'getlantern';
			break;
		case 6:
			name = 'boot';
			break;
		case 7:
			name = 'clicked';
			break;
		case 8:
      name = 'reboot';
			break;
		case 9:
      name = 'left';
			break;
    case 10:
      name = 'fullcolor';
      break;
    default:
      break;
  }
  if (id == 9 || id == 5) { return }
	return new Promise(async (resolve, reject) => {
		await axios
			.put(`http://${IP}/api/stations/${ID}`, {state: id, stateName: name})
			.then(async () => {
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

export async function getState() {
	return new Promise(async (resolve, reject) => {
		await axios
			.get(`http://${IP}/api/stations/${ID}`)
			.then((elm) => {
        resolve({ id: elm.data.state, name: elm.data.stateName });
			})
			.catch((err) => {
				reject(err);
			});
	});
}
