# OneHealth - Practice Management System

A comprehensive practice management web application built for healthcare providers in Namibia. OneHealth streamlines practice operations, enhances patient care, and provides powerful analytics for medical and dental practices.

## 🚀 Features

### Core Functionality
- **Multi-Practice Management** - Manage multiple practice locations from a single platform
- **User & Role Management** - Comprehensive user management with role-based access control
- **Tariff Management** - Import and manage medical/dental tariffs with custom pricing
- **Patient Management** - Complete patient records and medical history
- **Appointment Scheduling** - Advanced scheduling with conflict prevention
- **Billing & Invoicing** - Automated billing with medical aid integration
- **Analytics & Reports** - Detailed insights and financial reporting
- **Audit Logs** - Complete activity tracking for compliance

### Technical Features
- **Real-time Updates** - Live synchronization across all modules
- **Mobile Responsive** - Optimized for all devices
- **Secure Authentication** - Role-based access with Supabase Auth
- **API Integration** - RESTful APIs for all operations
- **Data Export** - Export reports in multiple formats
- **Backup & Recovery** - Automated data protection

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand, React Query
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18+ 
- npm or yarn
- Git
- Supabase account
- Vercel account (for deployment)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/onehealth.git
cd onehealth
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Database
DATABASE_URL=your_database_connection_string

# App Configuration
NEXT_PUBLIC_APP_NAME=OneHealth
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 4. Database Setup

1. Create a new Supabase project
2. Run the database migrations:

```bash
# Apply database schema
supabase db push
```

3. The migrations will create:
   - All required tables with proper relationships
   - Row Level Security (RLS) policies
   - Audit triggers
   - Sample data for testing

### 5. Start Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 Database Schema

### Core Tables

- **practices** - Practice locations and metadata
- **user_profiles** - Extended user information
- **user_practice_assignments** - User-practice relationships
- **patients** - Patient records and medical information
- **appointments** - Appointment scheduling and management
- **tariffs** - Pricing and tariff management
- **billing_records** - Invoices and payment tracking
- **audit_logs** - Activity tracking and compliance

### Key Features

- **Row Level Security** - Database-level access control
- **Audit Logging** - Automatic change tracking
- **Multi-tenancy** - Practice-based data isolation
- **Referential Integrity** - Proper foreign key relationships

## 🔐 Authentication & Authorization

### User Roles

1. **Admin** - System-wide access and management
2. **Practice Manager** - Full practice management capabilities
3. **Doctor** - Patient care and medical records
4. **Nurse** - Patient support and basic records
5. **Receptionist** - Appointments and basic operations

### Access Control

- Role-based permissions at database and application levels
- Practice-specific data access
- Secure API endpoints with proper authorization
- Audit logging for all sensitive operations

## 🏗 Project Structure

```
onehealth/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── auth/           # Authentication pages
│   │   ├── dashboard/      # Dashboard and main features
│   │   └── globals.css     # Global styles
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Base UI components
│   │   ├── layout/        # Layout components
│   │   └── providers.tsx   # Context providers
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── stores/            # State management
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper functions
├── supabase/
│   └── migrations/        # Database migrations
├── public/                # Static assets
└── docs/                  # Documentation
```

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Database
npm run db:generate     # Generate TypeScript types
npm run db:push         # Push migrations
npm run db:reset        # Reset database

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
```

### Code Quality

- **TypeScript** - Strict type checking enabled
- **ESLint** - Code linting with Next.js configuration
- **Prettier** - Code formatting
- **Husky** - Git hooks for quality checks

## 🚀 Deployment

### Vercel Deployment

1. **Prepare for deployment:**

```bash
npm run build
```

2. **Deploy to Vercel:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

3. **Environment Variables:**

Add the following environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Custom Deployment

For custom deployment, ensure:
- Node.js 18+ runtime
- Environment variables configured
- Database migrations applied
- Build assets generated

## 📖 Usage Guide

### Getting Started

1. **Create Account** - Register as a practice manager
2. **Setup Practice** - Add your practice information
3. **Invite Users** - Add staff members with appropriate roles
4. **Import Tariffs** - Upload your pricing structure
5. **Add Patients** - Begin patient registration
6. **Schedule Appointments** - Start booking appointments

### Key Workflows

#### Patient Management
- Register new patients with complete medical history
- Track medical aid information and coverage
- Manage appointments and visit history
- Generate patient reports

#### Appointment Scheduling
- Visual calendar with drag-and-drop scheduling
- Conflict detection and prevention
- Automated reminders and notifications
- Waitlist management

#### Billing & Invoicing
- Automated invoice generation
- Medical aid billing integration
- Payment tracking and reporting
- Overdue payment management

#### Analytics & Reporting
- Practice performance metrics
- Financial analysis and trends
- Patient demographics and insights
- Custom report generation

## 🔒 Security

### Data Protection
- End-to-end encryption for sensitive data
- HIPAA-compliant data handling
- Regular security audits and updates
- Secure backup and recovery procedures

### Access Control
- Multi-factor authentication support
- Role-based access control (RBAC)
- Session management and timeout
- API rate limiting and monitoring

## 🆘 Support

### Getting Help

- **Documentation** - Comprehensive guides and API docs
- **Community** - Join our user community
- **Support Email** - support@onehealth.na
- **Phone Support** - +264 XX XXX XXXX (business hours)

### Troubleshooting

Common issues and solutions:

1. **Database Connection Issues**
   - Check environment variables
   - Verify Supabase project status
   - Review network connectivity

2. **Authentication Problems**
   - Clear browser cache and cookies
   - Check email verification status
   - Verify user role assignments

3. **Performance Issues**
   - Monitor database query performance
   - Check network latency
   - Review browser console for errors

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Standards

- Follow TypeScript best practices
- Write comprehensive tests
- Document new features
- Follow existing code patterns

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Supabase** - Backend infrastructure and authentication
- **Vercel** - Deployment and hosting platform
- **Tailwind CSS** - Styling and design system
- **Radix UI** - Accessible UI components
- **React Query** - Data fetching and caching

---

**OneHealth** - Transforming healthcare practice management in Namibia.

For more information, visit [onehealth.na](https://onehealth.na)