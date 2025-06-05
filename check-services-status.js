#!/usr/bin/env node

import http from 'http';

const services = [
  {
    name: '🌐 Practice Landing Pages',
    port: 3000,
    path: '/',
    description: 'Multi-tenant practice websites (Dr. Polina, NewCharm, etc.)'
  },
  {
    name: '⚡ OneHealth Admin Portal', 
    port: 4000,
    path: '/',
    description: 'Practice management admin dashboard'
  },
  {
    name: '🏥 HPMS Practice Dashboard',
    port: 5000,
    path: '/',
    description: 'Main practice operations dashboard'
  }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: service.port,
      path: service.path,
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve({
        ...service,
        status: 'online',
        statusCode: res.statusCode
      });
    });

    req.on('error', () => {
      resolve({
        ...service,
        status: 'offline'
      });
    });

    req.on('timeout', () => {
      resolve({
        ...service,
        status: 'timeout'
      });
    });

    req.end();
  });
}

async function checkAllServices() {
  console.log('🔍 Checking HPMS Services Status\\n');
  
  const results = await Promise.all(services.map(checkService));
  
  results.forEach(result => {
    const statusIcon = result.status === 'online' ? '✅' : 
                      result.status === 'timeout' ? '⏱️' : '❌';
    const statusText = result.status === 'online' ? 'ONLINE' : 
                      result.status === 'timeout' ? 'TIMEOUT' : 'OFFLINE';
    
    console.log(`${statusIcon} ${result.name}`);
    console.log(`   Port: ${result.port}`);
    console.log(`   Status: ${statusText}`);
    if (result.statusCode) {
      console.log(`   HTTP: ${result.statusCode}`);
    }
    console.log(`   URL: http://localhost:${result.port}`);
    console.log(`   ${result.description}`);
    console.log('');
  });
  
  const onlineCount = results.filter(r => r.status === 'online').length;
  console.log(`📊 Services Online: ${onlineCount}/${results.length}`);
  
  if (onlineCount === 0) {
    console.log('\\n🚀 To start all services: npm run dev');
  } else if (onlineCount < results.length) {
    console.log('\\n⚠️  Some services are offline. Restart with: npm run dev');
  } else {
    console.log('\\n🎉 All HPMS services are running!');
  }
}

checkAllServices().catch(console.error);