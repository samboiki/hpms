# HPMS Port Mapping Configuration

## 🚀 OFFICIAL PORT MAPPINGS (DO NOT CHANGE)

### Local Development Ports:
- **localhost:3000** → Marketing/Landing Page (onehealthsystems.com)
- **localhost:4000** → Admin Dashboard (admin.onehealthsystems.com) 
- **localhost:5000** → Practice Management App (app.onehealthsystems.com)

### Production Domains:
- **onehealthsystems.com** → Marketing landing page
- **admin.onehealthsystems.com** → Admin dashboard for managing practices
- **app.onehealthsystems.com** → Main practice management application

## 🔧 Quick Start

```bash
# Use the official start script
./start-all-services.sh

# Or use npm directly
npm run dev
```

## ⚙️ Configuration Details

### Package.json Scripts:
- `dev:landing` → Runs on port 3000 (marketing page)
- `dev:admin` → Runs on port 4000 (admin dashboard)
- `dev:dashboard` → Runs on port 5000 (practice app)

### Service Directories:
- `/hpms-landing` → Marketing landing page
- `/onehealth` → Admin dashboard
- `/` (root) → Practice management app

## 🛑 Important Notes

1. **DO NOT CHANGE THESE PORT MAPPINGS** - They are configured to match production
2. The onehealth app automatically redirects to `/dashboard` when on port 4000
3. All services must run simultaneously for full functionality
4. Use `./start-all-services.sh` for guaranteed correct startup

## 🐛 Troubleshooting

If services are running on wrong ports:
1. Kill all Node processes: `pkill -f node`
2. Run: `./start-all-services.sh`
3. Verify ports are correct in browser

Last Updated: January 2025