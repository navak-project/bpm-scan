
import 'dotenv/config';
const { ID, IP, GROUP} = process.env;
import axios from "axios";

console.log(await getMinDeviceValue());
console.log(await getMaxDeviceValue());

async function getMinDeviceValue() {
  //return minvalue from database using axios
  return new Promise(async (resolve, reject) => {
    await axios
      .get(`http://${IP}/api/stations/${ID}`)
      .then((val) => {
        resolve(val.data.minDeviceValue);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

async function getMaxDeviceValue() {
  //return minvalue from database using axios
  return new Promise(async (resolve, reject) => {
    await axios
      .get(`http://${IP}/api/stations/${ID}`)
      .then((val) => {
        resolve(val.data.maxDeviceValue);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
let lantern = await getLantern()
console.log(lantern);
async function getLantern() {
  console.log('Getting Lantern...');
  let lantern;
  try {
    lantern = await axios.get(`http://${IP}/api/lanterns/randomUser/${GROUP}`);
    console.log(`Got: ${lantern.data.id}`);
    lantern=  lantern.data.id
  } catch (error) {
    console.log("🚀 ~ file: test.js ~ line 46 ~ getLantern ~ error", error.data);
    await axios.put(`http://${IP}/api/stations/${ID}`, { rgb: '50, 50, 50, 255', lantern: null });
   // await getLantern();
  }
  return lantern;
}

console.log(await getLantern());
