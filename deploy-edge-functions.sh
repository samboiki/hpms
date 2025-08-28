#!/bin/bash

# Deploy Edge Functions to Supabase
# Make sure you're logged in with: npx supabase login --token YOUR_ACCESS_TOKEN

echo "🚀 Deploying Edge Functions to Supabase..."
echo ""

# Check if logged in
echo "📋 Checking Supabase login status..."
npx supabase projects list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ You need to log in first!"
    echo "1. Get your access token from: https://app.supabase.com/account/tokens"
    echo "2. Run: npx supabase login --token YOUR_ACCESS_TOKEN"
    echo ""
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# Deploy send-individual-email function
echo "📧 Deploying send-individual-email function..."
npx supabase functions deploy send-individual-email --no-verify-jwt
if [ $? -eq 0 ]; then
    echo "✅ send-individual-email deployed successfully!"
else
    echo "❌ Failed to deploy send-individual-email"
    exit 1
fi

echo ""

# Deploy send-batch-email function
echo "📨 Deploying send-batch-email function..."
npx supabase functions deploy send-batch-email --no-verify-jwt
if [ $? -eq 0 ]; then
    echo "✅ send-batch-email deployed successfully!"
else
    echo "❌ Failed to deploy send-batch-email"
    exit 1
fi

echo ""
echo "🎉 All edge functions deployed successfully!"
echo ""
echo "📝 Remember to set your RESEND_API_KEY in Supabase Dashboard:"
echo "   1. Go to Project Settings > Edge Functions"
echo "   2. Add secret: RESEND_API_KEY = your-resend-api-key"
echo "   3. Optionally set SENDER_EMAIL (defaults to onboarding@resend.dev)"
echo ""
echo "🔍 Function URLs will be:"
echo "   - https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-individual-email"
echo "   - https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-batch-email"