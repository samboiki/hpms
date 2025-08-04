# OneHealth Systems Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     OneHealth Ecosystem                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Marketing Website (onehealthsystems.com)                   │
│     └─> Next.js app in /onehealth (main branch)               │
│         └─> For potential customers to learn about OneHealth   │
│                                                                │
│  2. Practice Management System (app.onehealthsystems.com)      │
│     └─> React app in root directory (localhost:5000)          │
│         └─> For doctors to manage their practices             │
│                                                                │
│  3. Admin Portal (admin.onehealthsystems.com)                 │
│     └─> Same React app with admin routes                      │
│         └─> For OneHealth team to manage all practices        │
│                                                                │
│  4. Individual Practice Websites                               │
│     └─> Next.js app branches (e.g., newcharmdental)          │
│         └─> For patients to book appointments, view services   │
│             Examples:                                          │
│             - newcharmdentalpractice.com                      │
│             - [otherpractice].com                             │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Stack

### Frontend Applications
1. **OneHealth Marketing** (Next.js 14)
   - Location: `/onehealth`
   - Purpose: Marketing, pricing, features
   - Users: Potential customers

2. **HPMS** (React + Vite)
   - Location: `/` (root)
   - Purpose: Practice management
   - Users: Doctors, staff, admin

3. **Practice Websites** (Next.js 14)
   - Location: `/onehealth` (branches)
   - Purpose: Patient-facing services
   - Users: Patients

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Edge Functions**: Supabase Functions

## Deployment Strategy

### Vercel Projects Needed:

1. **onehealth-marketing**
   - Repo: hpms/onehealth
   - Branch: main
   - Domain: onehealthsystems.com

2. **onehealth-app** 
   - Repo: hpms (root)
   - Branch: main
   - Domains: 
     - app.onehealthsystems.com
     - admin.onehealthsystems.com

3. **Practice Sites** (one per practice)
   - Repo: hpms/onehealth
   - Branch: [practice-name]
   - Domain: [practice-domain].com

## User Journeys

### Healthcare Provider Journey
1. Visits onehealthsystems.com
2. Signs up for OneHealth
3. Accesses app.onehealthsystems.com
4. Manages their practice

### Patient Journey
1. Visits their practice website (e.g., newcharmdentalpractice.com)
2. Books appointments
3. Views services
4. Accesses patient portal

### Admin Journey
1. Accesses admin.onehealthsystems.com
2. Manages all practices
3. Views analytics
4. Handles support

## Database Multi-tenancy

All systems share the same Supabase instance with RLS:
- Practices are isolated by `practice_id`
- Users have roles (admin, doctor, staff, patient)
- Each practice website shows only their data