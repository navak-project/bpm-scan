import http from 'http';
const host = 'localhost';
const port = 8000;
const requestListener = function (req, res) {
  res.writeHead(200);
  res.end("Station running!");
};
export function server() {
  const server = http.createServer(requestListener);
  server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
  });
}