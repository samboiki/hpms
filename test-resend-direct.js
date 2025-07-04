// Direct test of Resend API
const RESEND_API_KEY = 'ADD_YOUR_KEY_HERE'; // Replace with: re_bcMNuZ8E_3Q7gBRbFPJacTJFXYwaW4Fz6

async function testResendDirect() {
  try {
    console.log('Testing Resend API directly...');
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HPMS <onboarding@resend.dev>',
        to: 'ksnahol@gmail.com',
        subject: 'Test Email from HPMS - Direct Resend Test',
        html: '<p>This is a direct test of the Resend API to verify it works.</p>',
        text: 'This is a direct test of the Resend API to verify it works.'
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('Response body:', result);
    
    if (response.ok) {
      console.log('✅ Email sent successfully!');
    } else {
      console.log('❌ Failed to send email');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// To run this test:
// 1. Replace ADD_YOUR_KEY_HERE with your actual Resend API key
// 2. Run: node test-resend-direct.js
console.log('Remember to add your Resend API key before running!');
console.log('Your key: re_bcMNuZ8E_3Q7gBRbFPJacTJFXYwaW4Fz6');