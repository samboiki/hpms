#!/bin/bash

echo "Fixing Vercel environment variables for newcharmdental..."

# Create a .env file with the correct values
cat > .env.production.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dzxer8L4aIxCUOK7CnCM-A_YjHyS3En
EOF

echo "Environment file created."

# Build the project with the environment variables
echo "Building project with environment variables..."
npm run build

echo "Build complete. Now deploy to Vercel with these environment variables:"
echo ""
echo "NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dzxer8L4aIxCUOK7CnCM-A_YjHyS3En"
echo ""
echo "Add these in Vercel Dashboard > Settings > Environment Variables"