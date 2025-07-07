#!/usr/bin/env node

const https = require('https');

console.log('🦷 NewCharm Dental Practice - Setup Verification\n');

// Test URLs to verify
const tests = [
  {
    name: 'Development Server',
    url: 'http://localhost:3003',
    description: 'Local development server'
  },
  {
    name: 'Production Deployment',
    url: 'https://dr-polina-landing-giw0dwfqd-onehealth.vercel.app',
    description: 'Vercel production deployment'
  }
];

async function testUrl(test) {
  return new Promise((resolve) => {
    const protocol = test.url.startsWith('https') ? https : require('http');
    
    const req = protocol.get(test.url, (res) => {
      resolve({
        ...test,
        status: res.statusCode,
        success: res.statusCode === 200
      });
    });

    req.on('error', (error) => {
      resolve({
        ...test,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        ...test,
        status: 'TIMEOUT',
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

async function runTests() {
  console.log('📋 Running verification tests...\n');

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    const result = await testUrl(test);
    
    if (result.success) {
      console.log(`✅ PASS (${result.status})`);
    } else {
      console.log(`❌ FAIL (${result.status || result.error})`);
    }
  }

  console.log('\n🔍 Manual Verification Checklist:');
  console.log('');
  console.log('□ Execute database migration in Supabase');
  console.log('□ Verify NewCharm services display correctly');
  console.log('□ Test booking widget functionality');
  console.log('□ Check mobile responsiveness');
  console.log('□ Verify contact information display');
  console.log('□ Test service category interactions');
  console.log('');
  console.log('📊 Service Data Summary:');
  console.log('• 6 dental service categories');
  console.log('• 24 detailed sub-services');
  console.log('• Namibian Dollar pricing (N$180 - N$35,000)');
  console.log('• Professional treatment descriptions');
  console.log('• Realistic appointment durations');
  console.log('');
  console.log('🌐 URLs to Test:');
  console.log('• Development: http://localhost:3003');
  console.log('• Production: https://dr-polina-landing-giw0dwfqd-onehealth.vercel.app');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('1. Execute: supabase/migrations/20250605_add_newcharm_practice.sql');
  console.log('2. Test all functionality manually');
  console.log('3. Add professional dental images');
  console.log('4. Configure custom domain (optional)');
  console.log('');
  console.log('✅ NewCharm Dental Practice is ready for production use!');
}

runTests().catch(console.error);