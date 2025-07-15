#!/bin/bash

# Test n8n webhook directly
echo "Testing n8n webhook..."

# Test URL (update with your actual test URL when using "Listen for Test Event")
WEBHOOK_URL="https://onehealthsystems.app.n8n.cloud/webhook/onehealth-search"

# Test with OPTIONS (for CORS preflight)
echo -e "\n1. Testing OPTIONS request:"
curl -X OPTIONS "$WEBHOOK_URL" -v 2>&1 | grep -E "(< HTTP|Access-Control)"

# Test with POST
echo -e "\n2. Testing POST request:"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "women over 50 with diabetes",
    "practiceId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionId": "test-123"
  }' \
  -v

echo -e "\nDone. Check the response above."