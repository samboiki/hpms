# 🚀 Sophisticated Multi-Service HPMS Architecture

## Overview
This setup allows you to run ALL HPMS services simultaneously with a single command: `npm run dev`

## 🎯 Service Architecture

### Port Allocation Strategy
- **Port 3000**: 🌐 Practice Landing Pages (Public-facing websites)
- **Port 4000**: ⚡ OneHealth Admin Portal (Practice management)  
- **Port 5000**: 🏥 HPMS Practice Dashboard (Operations)

### 🏗️ Services Included

#### 1. 🌐 Practice Landing Pages (Port 3000)
**Technology**: Next.js 15 with multi-tenant architecture
**Features**:
- NewCharm Dental: `http://localhost:3000?practice=newcharm-dental`
- Dr. Polina Aesthetics: `http://localhost:3000?practice=dr-polina-aesthetics` 
- City Clinic: `http://localhost:3000?practice=cityclinic`
- All other practice websites

#### 2. ⚡ OneHealth Admin Portal (Port 4000)
**Technology**: Next.js 14 with premium typography
**Features**:
- Landing: `http://localhost:4000`
- Login: `http://localhost:4000/auth/login` (admin@onehealth.local / admin123)
- Dashboard: `http://localhost:4000/dashboard`
- Practice Management: `http://localhost:4000/dashboard/practices`
- Tariff Management: `http://localhost:4000/dashboard/tariffs`
- SMS Portal: `http://localhost:4000/dashboard/sms`

#### 3. 🏥 HPMS Practice Dashboard (Port 5000)
**Technology**: Vite + React 18
**Features**:
- Main URL: `http://localhost:5000`
- Patient management, appointments, medical records
- Practice operations and workflow management

## 🚀 Usage Commands

### Start All Services
```bash
npm run dev
```

### Individual Service Control
```bash
npm run dev:dashboard    # HPMS Dashboard only (port 5000)
npm run dev:landing      # Practice Landing Pages only (port 3000)
npm run dev:admin        # OneHealth Admin only (port 4000)
```

### Build All Services
```bash
npm run build:all
```

### Check Service Status
```bash
npm run services:status
```

### Stop All Services
```bash
pkill -f "next dev|vite"
```

## 🔧 Technical Implementation

### Concurrently Orchestration
- Uses `concurrently` package for sophisticated process management
- Color-coded console output with service names
- Automatic process cleanup when stopping

### Service Health Monitoring
- Built-in status checker (`check-services-status.js`)
- HTTP health checks for all services
- Visual status reporting

### Database Access
- All services use **direct PostgreSQL connection** (SET IN STONE in CLAUDE.md)
- Connection: `postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres`

## 🎨 Features

### 1. Multi-Tenant Practice Websites
- Dynamic practice switching via URL parameters
- Real images uploaded for NewCharm
- Professional dental/medical themes
- Booking widgets and contact forms

### 2. Admin Portal
- Premium typography (Poppins headers, Montserrat body)
- Comprehensive practice management
- Real-time analytics and reporting
- SMS portal integration

### 3. Practice Dashboard  
- Full practice operations suite
- Patient management and medical records
- Appointment scheduling and management
- Communication hub and messaging

## 🔄 Development Workflow

1. **Start Everything**: `npm run dev`
2. **Check Status**: `npm run services:status`  
3. **Access Services**: Use the URLs above
4. **Stop When Done**: `Ctrl+C` or `pkill -f "next dev|vite"`

## ✅ Verified Working Features

- ✅ All 3 services start simultaneously
- ✅ Proper port allocation (no conflicts)
- ✅ Real practice data and images loaded
- ✅ Admin authentication working
- ✅ Multi-tenant practice routing
- ✅ Database operations using direct PostgreSQL
- ✅ Premium typography and styling
- ✅ Service health monitoring

This sophisticated setup provides a complete development environment for all HPMS services with professional-grade orchestration and monitoring.