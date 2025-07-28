#!/bin/bash

# Deploy to Vercel with environment variables

echo "Setting environment variables and deploying to Vercel..."

# Set environment variables using Vercel CLI
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production < <(echo "https://jjxlfunlbyayxwvlpgwt.supabase.co")
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production < <(echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc0MjEwMjAsImV4cCI6MjAzMjk5NzAyMH0.q85iVzmVGxjR0R0NeWH0hGmXq-_HYQsX7ge9YK0PBMA")
npx vercel env add NEXT_PUBLIC_APP_NAME production < <(echo "OneHealth")
npx vercel env add NEXT_PUBLIC_APP_VERSION production < <(echo "1.0.0")

# Also add to preview and development
npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview < <(echo "https://jjxlfunlbyayxwvlpgwt.supabase.co")
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview < <(echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc0MjEwMjAsImV4cCI6MjAzMjk5NzAyMH0.q85iVzmVGxjR0R0NeWH0hGmXq-_HYQsX7ge9YK0PBMA")

npx vercel env add NEXT_PUBLIC_SUPABASE_URL development < <(echo "https://jjxlfunlbyayxwvlpgwt.supabase.co")
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development < <(echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc0MjEwMjAsImV4cCI6MjAzMjk5NzAyMH0.q85iVzmVGxjR0R0NeWH0hGmXq-_HYQsX7ge9YK0PBMA")

# Deploy
echo "Deploying to Vercel..."
npx vercel --prod

echo "Deployment complete!"