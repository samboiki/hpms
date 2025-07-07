# MCP (Model Context Protocol) Setup Guide for Supabase

## Prerequisites
- Node.js installed
- Supabase project credentials
- Claude Desktop app

## Step 1: Install MCP Supabase Server

```bash
npm install -g @modelcontextprotocol/server-supabase
```

## Step 2: Configure Claude Desktop

1. Locate your Claude Desktop config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Add the following configuration:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-supabase",
        "https://jjxlfunlbyayxwvlpgwt.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA"
      ]
    }
  }
}
```

## Step 3: Get Your Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the `service_role` key (keep this secret!)

## Step 4: Update Configuration

Replace `YOUR_SERVICE_ROLE_KEY` in the config with your actual service role key.

## Step 5: Restart Claude Desktop

Close and reopen Claude Desktop for the changes to take effect.

## Available MCP Commands

Once configured, Claude will have access to:
- Direct SQL queries
- Schema introspection
- Real-time table structure awareness
- Data manipulation capabilities

## Security Note

⚠️ The service role key bypasses Row Level Security. Only use this for development and keep the key secure!