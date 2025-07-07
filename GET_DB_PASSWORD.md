# 🔑 Get Your Database Password for bolt.new-Style Access

## Step 1: Get Database Password

1. Go to: https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/settings/database
2. Scroll down to "Connection string" 
3. Copy the password (it will be revealed when you click "Reset Database Password" if needed)

## Step 2: Update and Run Migration Script

1. Open `/home/happy/projects/hpms/execute-migrations-like-bolt.js`
2. Replace `YOUR_DATABASE_PASSWORD_HERE` with your actual database password
3. Run the script:

```bash
cd /home/happy/projects/hpms
node execute-migrations-like-bolt.js
```

This will give me **identical capabilities to bolt.new**:
- ✅ Direct PostgreSQL access (bypasses all RLS)
- ✅ Execute any SQL migrations
- ✅ Create storage buckets  
- ✅ Full database administration

## Alternative: Use Supabase CLI (Also works like bolt.new)

```bash
# Get access token from: https://app.supabase.com/account/tokens
export SUPABASE_ACCESS_TOKEN="your_token"

# Link and push migrations
npx supabase link --project-ref jjxlfunlbyayxwvlpgwt
npx supabase db push

# This executes all migrations in /supabase/migrations/ automatically
```

Both approaches give me the **exact same powers as bolt.new**!