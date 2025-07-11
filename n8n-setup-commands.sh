#!/bin/bash

# n8n Setup Script for OneHealth Systems
# Server IP: 139.59.90.136
# Domain: n8n.onehealthsystems.com

echo "Starting n8n setup..."

# 1. SSH into the server
echo "SSH into your server with:"
echo "ssh root@139.59.90.136"
echo "Password: T@ngisasA2x"
echo ""
echo "Then run these commands:"
echo ""

# 2. Update system
cat << 'EOF'
# Update system packages
apt update && apt upgrade -y

# Check n8n status
systemctl status n8n

# Install Nginx and Certbot for SSL
apt install nginx certbot python3-certbot-nginx -y

# Create Nginx configuration for n8n
cat > /etc/nginx/sites-available/n8n << 'NGINX'
server {
    server_name n8n.onehealthsystems.com;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
    }
    
    client_max_body_size 100M;
}
NGINX

# Enable the site
ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Restart nginx
systemctl restart nginx

# Wait for DNS to propagate (you might need to wait 5-10 minutes)
echo "Waiting for DNS propagation..."
sleep 10

# Get SSL certificate
certbot --nginx -d n8n.onehealthsystems.com --non-interactive --agree-tos --email admin@onehealthsystems.com

# Configure n8n environment
cat > /root/.n8n/config << 'N8NCONFIG'
{
  "basic.auth": {
    "active": true,
    "user": "admin",
    "password": "OneHealth@2025"
  },
  "host": "n8n.onehealthsystems.com",
  "protocol": "https",
  "port": 5678,
  "webhook_url": "https://n8n.onehealthsystems.com/",
  "timezone": "Africa/Johannesburg"
}
N8NCONFIG

# Create systemd environment file
cat > /etc/systemd/system/n8n.service.d/override.conf << 'SYSTEMD'
[Service]
Environment="N8N_BASIC_AUTH_ACTIVE=true"
Environment="N8N_BASIC_AUTH_USER=admin"
Environment="N8N_BASIC_AUTH_PASSWORD=OneHealth@2025"
Environment="N8N_HOST=n8n.onehealthsystems.com"
Environment="N8N_PROTOCOL=https"
Environment="N8N_PORT=5678"
Environment="WEBHOOK_URL=https://n8n.onehealthsystems.com/"
Environment="N8N_EDITOR_BASE_URL=https://n8n.onehealthsystems.com/"
Environment="VUE_APP_URL_BASE_API=https://n8n.onehealthsystems.com/"
Environment="N8N_ENCRYPTION_KEY=n8n_onehealth_2025_secure_key"
Environment="N8N_USER_FOLDER=/root/.n8n"
Environment="NODE_ENV=production"
Environment="N8N_LOG_LEVEL=info"
Environment="N8N_METRICS=true"
Environment="N8N_TIMEZONE=Africa/Johannesburg"
SYSTEMD

# Create the directory if it doesn't exist
mkdir -p /etc/systemd/system/n8n.service.d/

# Reload systemd and restart n8n
systemctl daemon-reload
systemctl restart n8n
systemctl enable n8n

# Check n8n status
systemctl status n8n

# Set up firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5678/tcp
ufw --force enable

# Create backup script
cat > /root/backup-n8n.sh << 'BACKUP'
#!/bin/bash
# n8n Backup Script
BACKUP_DIR="/root/n8n-backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/n8n-backup-$DATE.tar.gz /root/.n8n/
# Keep only last 7 days of backups
find $BACKUP_DIR -name "n8n-backup-*.tar.gz" -mtime +7 -delete
echo "Backup completed: $BACKUP_DIR/n8n-backup-$DATE.tar.gz"
BACKUP

chmod +x /root/backup-n8n.sh

# Add daily backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-n8n.sh") | crontab -

echo ""
echo "========================================="
echo "n8n Setup Complete!"
echo "========================================="
echo ""
echo "Access your n8n instance at:"
echo "https://n8n.onehealthsystems.com"
echo ""
echo "Login credentials:"
echo "Username: admin"
echo "Password: OneHealth@2025"
echo ""
echo "Important paths:"
echo "- n8n data: /root/.n8n/"
echo "- Nginx config: /etc/nginx/sites-available/n8n"
echo "- n8n service: systemctl status n8n"
echo "- Backup script: /root/backup-n8n.sh"
echo ""
echo "To view logs:"
echo "journalctl -u n8n -f"
echo ""
EOF