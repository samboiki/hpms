// Test attachment directly with the edge function
const testAttachmentDirect = async () => {
  // Create a simple test attachment
  const testContent = btoa("This is a test attachment content");
  
  const testData = {
    practiceId: "57e0b2e5-8b47-4a16-9b37-b3b0f3b0b0b0", // Replace with actual practice ID
    recipientEmail: "ksnahol@gmail.com",
    recipientName: "Test User",
    subject: "Direct Test Email with Attachment",
    textContent: "This is a test email with attachment sent directly to the edge function.",
    emailType: "test",
    attachments: [
      {
        filename: "test.txt",
        content: testContent,
        type: "text/plain"
      }
    ]
  };
  
  console.log('Sending test email with attachment:', testData);
  
  try {
    const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/centralized-email-gateway', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU2NDYxMjMsImV4cCI6MjA0MTIyMjEyM30.YZZvQAWtOLqYU3r1M4cMIXfnhgpXAFfHHFN3zG3Xk3A',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('Response:', result);
    
    if (result.success) {
      console.log('✅ Email sent successfully with attachment!');
    } else {
      console.error('❌ Email failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error calling edge function:', error);
  }
};

testAttachmentDirect();