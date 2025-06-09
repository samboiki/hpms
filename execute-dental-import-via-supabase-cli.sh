#!/bin/bash

# Execute dental codes import via Supabase CLI
# This script uses the service role key to import 179 dental codes

echo "🚀 Starting dental codes import via Supabase CLI..."

# Set environment variables
export SUPABASE_DB_URL="postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA"

echo "✅ Environment variables set"
echo "📊 Database URL: $SUPABASE_DB_URL"
echo "🔑 Using service role key"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    # Install Supabase CLI
    curl -sSL https://raw.githubusercontent.com/supabase/cli/main/scripts/install.sh | bash
    export PATH=$PATH:~/.local/bin
else
    echo "✅ Supabase CLI found"
fi

# Execute the import using the Node.js script we created
echo "📋 Executing dental codes import..."
node import-179-dental-codes-proper.js

# Verify the import
echo "🔍 Verifying import..."
node verify-179-codes.js

echo "🎉 Dental codes import completed via Supabase CLI approach!"