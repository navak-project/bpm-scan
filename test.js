import axios from 'axios';
async function getStations() {
  return new Promise(async (resolve, reject) => {
    await axios
      .get(`http://192.168.1.209:8081/api/stations/`)
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
      if (arr[key].presence === true && arr[key].lantern != null)
        return true;
    });
    alluser = isAllTrue;
    resolve(alluser);
  }).catch((err) => {
    reject(err);
  });
}


let alluser = false;

(function () {

})
while (!alluser) {
  await checkUsers();
}
