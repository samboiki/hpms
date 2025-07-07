#!/bin/bash

# Test edge function with curl
echo "🧪 Testing edge function directly with curl..."
echo ""

# Get auth token from the test file
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM"

# Test the simple function
echo "Testing test-simple function..."
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/test-simple \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": "Hello from curl"}' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v

echo ""
echo "Testing email-gateway-v2 function..."
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/email-gateway-v2 \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "practiceId": "b64632c2-3a56-44cf-a2c9-0e42be03a2d3",
    "recipientEmail": "ksnahol@gmail.com",
    "recipientName": "Test User",
    "subject": "Test from curl",
    "textContent": "Testing edge function with curl"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v