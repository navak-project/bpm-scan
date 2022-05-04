import {EventEmitter} from 'events';
export const eventEmitter = new EventEmitter();
import { setState, getState } from './states.js';
import { metrics } from './metrics.js';

eventEmitter.on('test', async () => {
	console.log('🚀 ~ file: events.js ~ line 6 ~ eventEmitter.on ~ test');
});

eventEmitter.on('connected', async () => {
	if (polarDevice === null || polarDevice === undefined) {
		return;
	}
	polarDevice.on('valuechanged', async (buffer) => {
		let json = JSON.stringify(buffer);
		let deviceHeartrate = Math.max.apply(null, JSON.parse(json).data);
		if (deviceHeartrate < 30 || deviceHeartrate > 180) {
			heartrate = randomIntFromInterval(70, 90);
			await metrics({bpm: heartrate});
			return;
		}
		heartrate = deviceHeartrate;
		await metrics({bpm: heartrate});
	});
});

eventEmitter.on('setDevice', async () => {
	await sleep(3000);
	try {
    polar = 
		eventEmitter.emit('connected');
	} catch (error) {
    console.log("🚀 ~ file: events.js ~ line 33 ~ eventEmitter.on ~ error", error);
		// console.log('No devices found!');
		// await metrics({polarStatus: 'No device'});
		// await metrics({polarState: 4});
		return;
	}
});

eventEmitter.on('getLantern', async () => {
	try {
		await getLantern();
	} catch (error) {
		//console.log(error);
		await sleep(2000);
		eventEmitter.emit('getLantern');
	}
});

eventEmitter.on('ready', async () => {
	await metrics({lantern: lantern.data.id});
	await setState(0);
	if (presence) {
		eventEmitter.emit('presence/true');
		return;
	}
	await metrics({message: 'Ready to scan'});
	console.log('Ready!');
});

eventEmitter.on('done', async () => {
	await setState(2);
	client.publish(`/lantern/${lantern.id}/audio/ignite`);
	await metrics({lantern: null});
	lantern = null;
	if (!presence) {
		done();
		return;
	}
	await metrics({message: 'Done!'});
});

eventEmitter.on('presence/true', async () => {
	let state = await getState();
	if (presence && state.name === 'ready') {
		await setState(7);
		await metrics({message: 'User Ready, waiting'});
		while (!alluser) {
			await checkUsers();
		}
		if (alluser) {
			await scan();
		}
	}
});

eventEmitter.on('presence/false', async (value) => {
	let state = await getState();
	alluser = false;
	if (state.name === 'scan' || state.name == 'outoflantern') {
		return;
	}
	if (state.name === 'done') {
		done();
		return;
	}
	eventEmitter.emit('ready');
});

eventEmitter.on('processexit', async (msg) => {
	await metrics({status: false});
	process.exit(0);
});
