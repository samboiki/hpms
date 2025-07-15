# Starting n8n for AI Patient Search

## Quick Start

### 1. Install n8n (if not already installed)
```bash
# Using npm
npm install -g n8n

# Or using Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### 2. Start n8n
```bash
# Start n8n on default port 5678
n8n start

# Or with tunnel for webhooks (recommended for testing)
n8n start --tunnel
```

### 3. Access n8n
Open your browser and go to:
```
http://localhost:5678
```

### 4. Import the Workflow
1. Click on "Workflows" in the left sidebar
2. Click "Add workflow" → "Import from File" 
3. Select `/home/happy/projects/hpms/n8n-workflows/ai-patient-search-advanced.json`
4. Or copy the JSON content and use "Import from URL or paste JSON"

### 5. Configure Credentials

You need to set up three credentials in n8n:

#### Supabase PostgreSQL
1. Go to Credentials → Add Credential → Postgres
2. Name it exactly: `Supabase PostgreSQL`
3. Enter:
   - Host: `db.jjxlfunlbyayxwvlpgwt.supabase.co`
   - Port: `5432`
   - Database: `postgres`
   - User: `postgres`
   - Password: Your Supabase database password
   - SSL: Enable and set "Reject Unauthorized" to false

#### OpenAI API
1. Go to Credentials → Add Credential → OpenAI API
2. Name it exactly: `OpenAI API`
3. Enter your OpenAI API key

#### xAI API
1. Go to Credentials → Add Credential → HTTP Request (Header Auth)
2. Name it exactly: `xAI API`
3. Set:
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_XAI_API_KEY`

### 6. Activate the Workflow
1. Open the imported workflow
2. Click the toggle switch to activate it
3. The webhook URL will be displayed

### 7. Update Frontend Configuration
If n8n is running on a different port or host, update the webhook URL in your `.env` file:
```
VITE_N8N_WEBHOOK_URL=http://localhost:5678/webhook/ai-patient-search
```

## Troubleshooting

### "Connection Refused" Error
- Make sure n8n is running: `n8n start`
- Check if port 5678 is already in use: `lsof -i :5678`
- Try a different port: `n8n start --port 5679`

### Webhook Not Working
- Use tunnel mode for local testing: `n8n start --tunnel`
- This gives you a public URL for webhooks
- Update the webhook URL in your frontend accordingly

### Docker Alternative
If you prefer Docker:
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=false \
  -e N8N_HOST=localhost \
  -e N8N_PORT=5678 \
  -e N8N_PROTOCOL=http \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Using PM2 (Production)
```bash
# Install PM2
npm install -g pm2

# Start n8n with PM2
pm2 start n8n -- start

# View logs
pm2 logs n8n

# Stop n8n
pm2 stop n8n
```

## Webhook URL Structure

The workflow creates these endpoints:

1. **Main Search Endpoint**
   ```
   POST http://localhost:5678/webhook/ai-patient-search
   ```

2. **Progress Updates (Optional)**
   The workflow attempts to send progress to:
   ```
   POST http://localhost:5678/webhook/progress-{sessionId}
   ```
   These are optional and won't break the workflow if unavailable.

## Testing the Setup

Once n8n is running and the workflow is active, test it:

```bash
curl -X POST http://localhost:5678/webhook/ai-patient-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test search",
    "practiceId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionId": "test-123"
  }'
```

You should get a response (might be an error about practice ID, but it confirms n8n is working).

## Production Considerations

1. **Use Environment Variables**
   ```bash
   N8N_BASIC_AUTH_ACTIVE=true
   N8N_BASIC_AUTH_USER=admin
   N8N_BASIC_AUTH_PASSWORD=your-password
   N8N_WEBHOOK_URL=https://your-domain.com/
   ```

2. **Use a Reverse Proxy** (nginx example)
   ```nginx
   location /webhook/ {
     proxy_pass http://localhost:5678/webhook/;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection 'upgrade';
     proxy_set_header Host $host;
     proxy_cache_bypass $http_upgrade;
   }
   ```

3. **Enable SSL**
   - Use Let's Encrypt with nginx
   - Or use n8n's built-in SSL options

4. **Database for n8n**
   By default, n8n uses SQLite. For production, use PostgreSQL:
   ```bash
   N8N_DATABASE_TYPE=postgresdb
   N8N_DATABASE_POSTGRES_HOST=localhost
   N8N_DATABASE_POSTGRES_PORT=5432
   N8N_DATABASE_POSTGRES_DATABASE=n8n
   N8N_DATABASE_POSTGRES_USER=n8n
   N8N_DATABASE_POSTGRES_PASSWORD=password
   ```