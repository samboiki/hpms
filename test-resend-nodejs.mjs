import https from 'https';

const RESEND_API_KEY = 're_bcMNuZ8E_3Q7gBRbFPJacTJFXYwaW4Fz6';

const emailData = {
  from: 'onboarding@resend.dev',
  to: 'ksnahol@gmail.com',
  subject: 'Test from Node.js',
  html: '<p>Testing Resend API from Node.js</p>',
  text: 'Testing Resend API from Node.js'
};

const options = {
  hostname: 'api.resend.com',
  port: 443,
  path: '/emails',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': JSON.stringify(emailData).length
  }
};

console.log('🚀 Testing Resend API...');
console.log('Sending to:', emailData.to);
console.log('From:', emailData.from);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📧 Response Status:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      console.log('✅ Email sent successfully!');
    } else {
      console.log('❌ Failed to send email');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(JSON.stringify(emailData));
req.end();