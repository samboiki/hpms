# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev        # Start development server (Vite)
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Database
```bash
npx supabase start     # Start local Supabase instance
npx supabase stop      # Stop local Supabase instance
npx supabase db push   # Push migrations to database
npx supabase db reset  # Reset database and apply migrations
```

## Architecture Overview

This is a Hospital Practice Management System (HPMS) built for Namibian healthcare providers. It's a React/TypeScript single-page application using Supabase as the backend.

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand for global state, React Query for server state
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Styling**: Tailwind CSS with custom design tokens
- **Forms**: React Hook Form for form handling
- **Routing**: React Router v6

### Key Architectural Patterns

1. **Authentication Flow**:
   - Supabase Auth handles authentication
   - Auth state stored in Zustand (`authStore.ts`)
   - Protected routes check auth state and user roles
   - Four user roles: admin, doctor, nurse, receptionist

2. **Data Flow**:
   - Supabase client initialized in `lib/supabase.ts`
   - React Query handles data fetching, caching, and mutations
   - Zustand stores manage global UI state
   - Row Level Security (RLS) policies enforce data access

3. **Component Structure**:
   - Pages in `/pages` map to routes
   - Reusable components in `/components` organized by feature
   - Form components handle complex multi-step forms
   - UI components provide consistent design elements

4. **Database Schema**:
   - Core entities: patients, appointments, medical_records, visits
   - Supporting tables: vitals, lab_requests, media_requests, messages
   - All tables have created_at, updated_at timestamps
   - Foreign keys maintain referential integrity

### Important Conventions

1. **Styling**: 
   - Use Tailwind CSS classes
   - Brand color: `#01b9d4` (cyan/teal)
   - Card-based UI with consistent shadows

2. **Forms**:
   - Use React Hook Form for all forms
   - Validation should match database constraints
   - Show loading states during submission

3. **Error Handling**:
   - Display user-friendly error messages
   - Log errors to console in development
   - Handle Supabase-specific errors appropriately

4. **Type Safety**:
   - Define TypeScript interfaces for all data models
   - Use strict typing for Supabase queries
   - Avoid `any` types

5. **Performance**:
   - Use React Query for efficient data caching
   - Implement pagination for large datasets
   - Lazy load components where appropriate