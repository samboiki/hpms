# HPMS Landing Pages

Multi-tenant landing page system for medical practices using the HPMS platform.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Test Locally
```bash
# Terminal 1 - City Clinic (http://localhost:3000)
npm run dev:cityclinic

# Terminal 2 - Coastal Medical (http://localhost:3001)
npm run dev:coastalmed
```

## 📦 Deploy to Vercel

### Method 1: Using Vercel CLI
```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy: Y
# - Which scope: Select your account
# - Link to existing project: N
# - Project name: hpms-landing
# - Directory: ./
# - Override settings: N
```

### Method 2: Using GitHub Integration

1. Push this code to a GitHub repository
2. Go to https://vercel.com/new
3. Import your repository
4. Configure:
   - Framework Preset: Next.js
   - Root Directory: hpms-landing (if in a monorepo)
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 3. Add Multiple Domains

After deployment, add domains for each practice:

1. Go to your project in Vercel Dashboard
2. Go to Settings → Domains
3. Add domains:
   - `hpms-cityclinic.vercel.app`
   - `hpms-coastalmed.vercel.app`

### 4. Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_HPMS_URL=https://your-hpms-app.vercel.app
```

## 🏥 Practice Configuration

Each practice is configured in the database with:
- Custom branding (colors, logo)
- Services offered
- Contact information
- Business hours
- Feature flags

## 🔧 Development

### Project Structure
```
src/
├── app/
│   └── page.tsx          # Main page (dynamic based on domain)
├── components/
│   ├── Navbar.tsx        # Navigation
│   ├── HeroSection.tsx   # Hero banner
│   ├── ServicesSection.tsx
│   ├── AboutSection.tsx
│   ├── BookingWidget.tsx # Appointment form
│   ├── ContactSection.tsx
│   └── Footer.tsx
└── lib/
    ├── supabase.ts       # Database client
    └── tenants.ts        # Multi-tenant logic
```

### Adding a New Practice

1. Insert into database:
```sql
INSERT INTO practices (slug, name, domain, ...) 
VALUES ('newpractice', 'New Practice', 'newpractice.vercel.app', ...);
```

2. Add domain in Vercel
3. Update DNS if using custom domain

## 🌐 Custom Domains

To use custom domains (e.g., cityclinic.com):

1. Add domain in Vercel Dashboard
2. Update DNS records:
   - A Record: 76.76.21.21
   - CNAME: cname.vercel-dns.com
3. Update practice domain in database

## 📱 Features

- ✅ Responsive design
- ✅ Dynamic branding per practice
- ✅ Online appointment booking
- ✅ Service showcase
- ✅ Contact information
- ✅ Business hours display
- ✅ SEO optimized
- ✅ Fast loading with Next.js

## 🔒 Security

- Row Level Security (RLS) ensures data isolation
- Each practice only sees their own data
- Secure authentication through HPMS portal

## 📞 Support

For issues or questions, contact the HPMS team.