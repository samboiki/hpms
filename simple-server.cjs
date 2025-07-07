const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>HPMS Dev Server Test</title></head>
      <body>
        <h1>🎉 Server is working!</h1>
        <p>Time: ${new Date().toISOString()}</p>
        <p>This proves the network connection is fine.</p>
        <script>
          setInterval(() => {
            document.querySelector('p').innerHTML = 'Time: ' + new Date().toISOString();
          }, 1000);
        </script>
      </body>
    </html>
  `);
});

const PORT = 3001;
server.listen(PORT, 'localhost', () => {
  console.log(`✅ Test server running at http://localhost:${PORT}`);
  console.log('🔗 This server will NEVER disconnect!');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});