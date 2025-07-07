# 🦷 NewCharm Development Guide - Multi-Practice Routing

## 🚀 The Problem (SOLVED!)

**Before**: You needed specific ports to access different practices:
- ❌ Port 3000 → City Clinic  
- ❌ Port 3001 → Coastal Med
- ❌ Port 3002 → Dr. Polina
- ❌ Port 3003 → NewCharm ← **Often failed if port was busy**

**Now**: Access ANY practice on ANY port with multiple methods! 🎉

---

## ✨ 4 Ways to Access NewCharm (and any practice)

### **Method 1: Query Parameter (Easiest)**
```bash
# Start dev server on ANY available port
npm run dev

# Access NewCharm on any port:
http://localhost:3000?practice=newcharm-dental
http://localhost:3001?practice=newcharm-dental
http://localhost:3002?practice=newcharm-dental
```

### **Method 2: Environment Variable (Permanent)**
```bash
# Set default practice in .env.local
echo "NEXT_PUBLIC_PRACTICE=newcharm-dental" > .env.local

# Now ANY localhost port shows NewCharm by default
npm run dev
# → http://localhost:3000 automatically shows NewCharm
```

### **Method 3: UI Practice Switcher (Interactive)**
- Look for the practice switcher in the top navbar
- Click to see dropdown with all available practices
- Switch instantly without changing URLs

### **Method 4: Port Mapping (Backward Compatible)**
```bash
# Traditional method still works
npm run dev
# → http://localhost:3003 (if available) shows NewCharm
```

---

## 🛠️ Quick Setup

### **1. Environment Setup**
```bash
cd /path/to/hpms/hpms-landing

# Copy environment template
cp .env.example .env.local

# Edit .env.local and set your preferred practice
echo "NEXT_PUBLIC_PRACTICE=newcharm-dental" >> .env.local
```

### **2. Start Development**
```bash
# Start development server
npm run dev

# Server will start on first available port (usually 3000)
# Access NewCharm immediately at the provided URL
```

### **3. Test All Methods**
```bash
# Method 1: Query parameter
curl "http://localhost:3000?practice=newcharm-dental"

# Method 2: Environment variable (already set)
curl "http://localhost:3000"

# Method 3: Use the UI switcher in browser

# Method 4: Traditional port (if available)
curl "http://localhost:3003"
```

---

## 🎯 Available Practices

| Practice | Slug | Query Parameter |
|----------|------|-----------------|
| **NewCharm Dental** | `newcharm-dental` | `?practice=newcharm-dental` |
| Dr. Polina Aesthetics | `dr-polina-aesthetics` | `?practice=dr-polina-aesthetics` |
| City Clinic | `cityclinic` | `?practice=cityclinic` |
| Coastal Medical | `coastalmed` | `?practice=coastalmed` |

---

## 🔧 Advanced Configuration

### **Package.json Scripts**
```json
{
  "scripts": {
    "dev": "next dev",
    "dev:newcharm": "NEXT_PUBLIC_PRACTICE=newcharm-dental next dev",
    "dev:polina": "NEXT_PUBLIC_PRACTICE=dr-polina-aesthetics next dev",
    "dev:city": "NEXT_PUBLIC_PRACTICE=cityclinic next dev",
    "dev:coastal": "NEXT_PUBLIC_PRACTICE=coastalmed next dev"
  }
}
```

### **Multiple Environments**
```bash
# Development with NewCharm
npm run dev:newcharm

# Development with Dr. Polina
npm run dev:polina

# Development with specific port and practice
NEXT_PUBLIC_PRACTICE=newcharm-dental npm run dev -- -p 3003
```

---

## 🎨 UI Features

### **Practice Switcher Component**
- Beautiful dropdown in navbar
- Shows all available practices
- Instant switching with smooth animations
- Mobile responsive design

### **Visual Indicators**
- Each practice has unique colors and icons
- Current practice highlighted in switcher
- Smooth transitions between practices

---

## 🐛 Troubleshooting

### **Problem**: "Port 3003 is in use"
**Solution**: Use any available port with query parameter
```bash
npm run dev
# Server starts on port 3000 (or first available)
# Access: http://localhost:3000?practice=newcharm-dental
```

### **Problem**: "Wrong practice loads"
**Solutions**:
1. **Quick**: Add `?practice=newcharm-dental` to URL
2. **Permanent**: Set `NEXT_PUBLIC_PRACTICE=newcharm-dental` in `.env.local`
3. **Interactive**: Use practice switcher in navbar

### **Problem**: "Database not found"
**Solution**: Execute the migration first
```sql
-- In Supabase SQL Editor:
-- Run: NEWCHARM_WITH_LOCAL_IMAGES.sql
```

---

## 🚀 Production Deployment

### **Environment Variables**
```bash
# Vercel deployment
vercel env add NEXT_PUBLIC_PRACTICE newcharm-dental

# Or in vercel.json:
{
  "env": {
    "NEXT_PUBLIC_PRACTICE": "newcharm-dental"
  }
}
```

### **Domain Mapping**
```javascript
// Automatic domain detection in production
newcharm.vercel.app → NewCharm Dental
drpolina.vercel.app → Dr. Polina Aesthetics
```

---

## ✅ Benefits of New System

1. **🎯 Flexible**: Access any practice on any port
2. **🔄 Instant Switching**: Change practices without restarting server
3. **🛡️ Backward Compatible**: Old port mapping still works
4. **🎨 User Friendly**: Beautiful UI switcher component
5. **⚡ Efficient**: No more port conflicts or restarts
6. **🌍 Production Ready**: Environment variable support

---

## 📝 Development Workflow

```bash
# 1. Start development
npm run dev

# 2. Choose your method:
# Option A: Query parameter
open "http://localhost:3000?practice=newcharm-dental"

# Option B: Environment variable
echo "NEXT_PUBLIC_PRACTICE=newcharm-dental" >> .env.local
open "http://localhost:3000"

# Option C: UI switcher
# Just click the switcher in the navbar

# 3. Develop and test
# Switch between practices instantly for testing
```

**🎉 No more port conflicts! Access NewCharm (or any practice) effortlessly!**