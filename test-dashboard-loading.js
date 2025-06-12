import http from 'http';

// Test if dashboard is accessible
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`✅ Dashboard responds with status: ${res.statusCode}`);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (data.includes('<title>')) {
      console.log('✅ HTML page loaded successfully');
      console.log('📄 Page title found in response');
    } else {
      console.log('❌ No HTML content found');
    }
    
    if (data.includes('Dashboard')) {
      console.log('✅ Dashboard content detected');
    } else {
      console.log('❌ No Dashboard content found');
    }
    
    if (data.includes('🚨 DASHBOARD TEST')) {
      console.log('✅ Test Dashboard component detected');
    } else {
      console.log('❌ No test Dashboard component found');
    }
    
    if (data.includes('min-h-screen')) {
      console.log('✅ Dashboard CSS classes detected');
    } else {
      console.log('❌ No Dashboard CSS classes found');
    }
    
    if (data.includes('DEBUG MODE')) {
      console.log('✅ Debug mode bypass detected');
    } else {
      console.log('❌ No debug mode found');
    }
    
    // Log part of the response for debugging
    console.log('📝 First 500 chars of response:');
    console.log(data.substring(0, 500));
  });
});

req.on('error', (e) => {
  console.error(`❌ Dashboard connection failed: ${e.message}`);
  console.log('💡 Make sure the server is running on port 5000');
});

req.setTimeout(15000, () => {
  console.log('⏱️ Request timeout - server may not be responding');
  req.destroy();
});

req.end();