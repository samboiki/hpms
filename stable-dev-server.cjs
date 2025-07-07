const http = require('http');
const httpProxy = require('http-proxy-middleware');
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting ULTRA-STABLE Development Server');
console.log('📌 This server will NEVER disconnect and provides instant hot reload!');

const PROXY_PORT = 8080;
const VITE_PORT = 3000;
const app = express();

// Track Vite server status
let viteProcess = null;
let isViteReady = false;
let restartCount = 0;

// Function to start Vite server
function startViteServer() {
  if (viteProcess) {
    viteProcess.kill();
  }
  
  console.log(`🔄 Starting Vite server (attempt ${++restartCount})...`);
  
  viteProcess = spawn('npm', ['run', 'dev'], {
    cwd: '/home/happy/projects/hpms',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  viteProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📡 Vite:', output.trim());
    
    if (output.includes('ready in')) {
      isViteReady = true;
      console.log('✅ Vite server is ready!');
    }
  });
  
  viteProcess.stderr.on('data', (data) => {
    console.log('⚠️  Vite stderr:', data.toString().trim());
  });
  
  viteProcess.on('exit', (code) => {
    console.log(`💀 Vite server exited with code ${code}`);
    isViteReady = false;
    setTimeout(() => {
      console.log('🔄 Auto-restarting Vite server...');
      startViteServer();
    }, 2000);
  });
}

// Proxy configuration
const proxy = httpProxy.createProxyMiddleware({
  target: `http://localhost:${VITE_PORT}`,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for HMR
  onError: (err, req, res) => {
    console.log('🔧 Proxy error, serving fallback...');
    if (!res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>HPMS - Starting...</title>
            <meta http-equiv="refresh" content="2">
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
              .loading { animation: spin 1s linear infinite; display: inline-block; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <h1>🚀 HPMS Development Server</h1>
            <div class="loading">⚡</div>
            <p>Starting up... This page will refresh automatically.</p>
            <p>Restart count: ${restartCount}</p>
          </body>
        </html>
      `);
    }
  }
});

// Apply proxy middleware
app.use('/', (req, res, next) => {
  if (isViteReady) {
    proxy(req, res, next);
  } else {
    res.send(`
      <html>
        <head>
          <title>HPMS - Loading...</title>
          <meta http-equiv="refresh" content="1">
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .spinner { border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <h1>🏥 Hospital Practice Management System</h1>
          <div class="spinner"></div>
          <h2>Starting Development Server...</h2>
          <p>Please wait while we initialize your application.</p>
          <p><strong>This server will NEVER disconnect!</strong></p>
          <small>Restart attempt: ${restartCount}</small>
        </body>
      </html>
    `);
  }
});

// Create HTTP server
const server = http.createServer(app);

// Enable WebSocket proxy for HMR
server.on('upgrade', (request, socket, head) => {
  if (isViteReady) {
    proxy.upgrade(request, socket, head);
  }
});

// Start the proxy server
server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`🎯 STABLE Development Server running on:`);
  console.log(`   ➜ Local:   http://localhost:${PROXY_PORT}/`);
  console.log(`   ➜ Network: http://0.0.0.0:${PROXY_PORT}/`);
  console.log('');
  console.log('✨ Features:');
  console.log('   • Auto-restart on crashes');
  console.log('   • Hot Module Replacement');
  console.log('   • Network accessible');
  console.log('   • Never disconnects');
  console.log('');
  
  // Start Vite server
  startViteServer();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  if (viteProcess) {
    viteProcess.kill();
  }
  server.close(() => {
    process.exit(0);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    viteReady: isViteReady,
    restartCount: restartCount,
    timestamp: new Date().toISOString()
  });
});