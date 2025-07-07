# MCP Supabase Setup Guide for HPMS

This guide will help you connect your Supabase database directly to Claude for enhanced database operations.

## Prerequisites

1. **Node.js** installed (v16 or higher)
2. **Claude Desktop** app
3. **Supabase Service Role Key** (we'll get this below)

## Step 1: Get Your Supabase Service Role Key

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. Navigate to **Settings** → **API**
3. Find the **Service Role Key** under "Project API keys"
   - ⚠️ **IMPORTANT**: This key has full access to your database. Keep it secure!
   - It starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Copy this key - you'll need it in Step 3

## Step 2: Install MCP Supabase Server

The MCP Supabase server is available as `supabase-mcp`. You have two options:

### Option A: Global Install (Requires sudo)
```bash
sudo npm install -g supabase-mcp
```

### Option B: Use npx (No installation needed - RECOMMENDED)
Skip installation! The configuration below will use `npx` to run the package directly.

## Step 3: Configure Claude Desktop

1. Find your Claude Desktop configuration file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Open the file in a text editor (create it if it doesn't exist)

3. Add or update the configuration:

```json
{
  "mcpServers": {
    "supabase-hpms": {
      "command": "npx",
      "args": ["-y", "supabase-mcp"],
      "env": {
        "SUPABASE_URL": "https://jjxlfunlbyayxwvlpgwt.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY_HERE"
      }
    }
  }
}
```

4. Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key from Step 1

5. Save the file

## Step 4: Restart Claude Desktop

1. Completely quit Claude Desktop (not just close the window)
2. Start Claude Desktop again
3. The MCP server should now be connected

## Step 5: Verify Connection

Once restarted, you can ask Claude to:
- "Show me all tables in the database"
- "Query the patients table"
- "Count how many patients have 'maria' in their email"

## Available MCP Tools

With MCP Supabase connected, Claude will have access to these tools:

### Database Operations
- **select**: Query data from tables with filters, ordering, and pagination
- **insert**: Add new records to tables
- **update**: Modify existing records
- **delete**: Remove records from tables
- **rpc**: Execute stored procedures/functions

### Schema Information
- **list-tables**: Get all tables in your database
- **describe-table**: Get detailed schema for a specific table

### Example Usage
Once connected, you can ask Claude things like:
- "Show me all patients with 'maria' in their email"
- "Insert a new patient record"
- "Update the visit status to completed"
- "List all tables in the database"
- "Describe the structure of the visits table"

## Security Best Practices

1. **Never share your service role key** - It has full database access
2. **Consider creating a custom role** with limited permissions if you want more security
3. **Regularly rotate your keys** from the Supabase dashboard
4. **Monitor database activity** in the Supabase dashboard

## Troubleshooting

### MCP Not Connecting
1. Check the config file syntax (valid JSON)
2. Ensure the service role key is correct
3. Check Claude Desktop logs:
   - **macOS**: `~/Library/Logs/Claude/`
   - **Windows**: `%APPDATA%\Claude\logs\`

### Permission Errors
- Make sure you're using the service role key, not the anon key
- Check if RLS policies are blocking access

### Query Errors
- Verify table and column names match exactly
- Check data types in your queries
- Look for SQL syntax errors

## Alternative: Limited Access Setup

If you prefer not to use the service role key, you can create a custom database role:

```sql
-- Run this in Supabase SQL editor
CREATE ROLE claude_readonly WITH LOGIN PASSWORD 'secure_password';
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_readonly;
```

Then use this role's credentials in the MCP configuration instead.

## Next Steps

Once connected, Claude can:
- Directly query your database
- Help write complex SQL queries
- Analyze your data structure
- Suggest optimizations
- Create database migrations
- Debug data issues

Need help? Just ask Claude about any database operations!