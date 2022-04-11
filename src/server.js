import http from 'http';

export function server() {
	return new Promise((resolve, reject) => {
		try {
			var server = http.createServer(function (req, res) {
				if (req.url == '/') {
					//check the URL of the current request
					res.writeHead(200, {'Content-Type': 'application/json'});
					res.write(JSON.stringify({message: 'Hello World'}));
					res.end();
				}
			});

			server.listen(5000);
			resolve('Server running');
			console.log('Node.js web server at port 5000 is running..');
		} catch (e) {
			reject(e);
		}
	});
}
