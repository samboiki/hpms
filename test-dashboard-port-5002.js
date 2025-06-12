import http from 'http';

// Test if dashboard is accessible on port 5002
const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`✅ Dashboard responds on port 5002 with status: ${res.statusCode}`);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (data.includes('<title>')) {
      console.log('✅ HTML page loaded successfully');
    } else {
      console.log('❌ No HTML content found');
    }
    
    if (data.includes('Dashboard')) {
      console.log('✅ Dashboard content detected');
    } else {
      console.log('❌ No Dashboard content found');
    }
    
    // Check for specific UI elements we updated
    if (data.includes('Premium Week Calendar')) {
      console.log('✅ Week calendar component detected');
    } else {
      console.log('❌ No week calendar found');
    }
    
    if (data.includes('glassmorphic')) {
      console.log('✅ Glassmorphic styling detected');
    } else {
      console.log('❌ No glassmorphic styling found');
    }
    
    console.log('📝 Dashboard is ready for testing on port 5002');
  });
});

req.on('error', (e) => {
  console.error(`❌ Dashboard connection failed: ${e.message}`);
  console.log('💡 Dashboard might be running on a different port');
});

req.setTimeout(10000, () => {
  console.log('⏱️ Request timeout');
  req.destroy();
});

req.end();