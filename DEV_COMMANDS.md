# Development Commands

## Quick Start

### Option 1: Clean Start (Recommended)
```bash
npm start
```
This automatically cleans ports and starts all services.

### Option 2: Manual Clean + Start
```bash
npm run kill-ports
npm run dev
```

### Option 3: Alternative Ports (if main ports conflict)
```bash
npm run dev:safe
```
Uses ports 3001, 4001 instead of 3000, 4000.

## Individual Services

### Dashboard Only (Main App)
```bash
npm run dev:dashboard-only
# Runs on http://localhost:5000
```

### Landing Page Only
```bash
npm run dev:landing
# Runs on http://localhost:3000
```

### Admin Panel Only
```bash
npm run dev:admin
# Runs on http://localhost:4000
```

## Port Management

### Check and Kill Conflicting Ports
```bash
npm run kill-ports
```

### Manual Port Cleanup (if needed)
```bash
sudo lsof -ti:3000 | xargs sudo kill -9
sudo lsof -ti:4000 | xargs sudo kill -9  
sudo lsof -ti:5000 | xargs sudo kill -9
```

## Troubleshooting

### If you get "EADDRINUSE" errors:
1. Run `npm run kill-ports`
2. Wait 5 seconds
3. Run `npm run dev`

### If ports are still in use:
1. Run `npm run dev:safe` (uses alternative ports)
2. Or manually kill processes: `sudo pkill -f "node"`

### If Vite shows "outdated dependencies":
1. Stop the server (Ctrl+C)
2. Run `rm -rf node_modules/.vite`
3. Run `npm start`

## Service URLs

- **Dashboard**: http://localhost:5000 (Main HPMS App)
- **Landing**: http://localhost:3000 (Marketing Site) 
- **Admin**: http://localhost:4000 (Admin Panel)

## Alternative URLs (dev:safe mode)

- **Dashboard**: http://localhost:5000 (Same)
- **Landing**: http://localhost:3001 (Alternative)
- **Admin**: http://localhost:4001 (Alternative)