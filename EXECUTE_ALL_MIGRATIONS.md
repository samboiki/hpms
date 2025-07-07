# Complete Migration Execution Guide

## Step 1: Execute Main Migration
Go to **Supabase Dashboard** → **SQL Editor**: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new

Copy and execute the contents of: `supabase/migrations/20250605000001_comprehensive_practice_management_system_fixed.sql`

## Step 2: Import Dental Tariffs
After the main migration succeeds, execute: `import_dental_tariffs.sql`

## Step 3: Create OneHealth Admin Users
Execute: `create_onehealth_admin_complete.sql`

## Step 4: Setup SMS Management
Execute: `setup_sms_management.sql`

## Login Credentials

### OneHealth Admin Portal
- **Super Admin Email**: `admin@onehealth.na`
- **Practice Manager Email**: `manager@onehealth.na`
- **Password**: `OneHealth2025!`
- **Login URL**: https://jjxlfunlbyayxwvlpgwt.supabase.co/auth/v1/admin/users

### Main Application
- **URL**: https://hpms-one.vercel.app/
- **Dr. Polina Admin**: `polina@clinic.na` / `polina2024`

## Key Features After Migration

### 1. Enhanced Tariff Management
- Practice types: dental, medical, aesthetic, specialist, general
- Practice subtypes (array): e.g., ['General Dental Practitioners', 'Specialists']
- Full dental tariff catalog imported for all dental practices
- Proper categorization and pricing structure

### 2. SMS Management System
- SMS plans: Starter (500), Professional (2000), Enterprise (10000)
- Usage tracking and billing
- Portal configuration for SMS API integration
- Automated SMS allocation based on practice subscription tier

### 3. Comprehensive Reporting Views
- `practice_performance_dashboard`: Overall practice metrics
- `financial_summary_by_practice`: Revenue and cost analysis
- `appointment_analytics`: Appointment patterns and efficiency
- `sms_analytics`: SMS usage and delivery rates
- `sms_management_dashboard`: SMS allocation and usage tracking

### 4. OneHealth Admin System
- Super admin and role-based access
- Audit logging for all admin actions
- Practice management capabilities
- SMS allocation functions

## Next Steps

1. **Configure SMS Portal API**
   - Update SMS portal credentials in `sms_portal_config` table
   - Set correct API endpoint, username, password, and API key
   - Test SMS sending functionality

2. **Test Admin Access**
   - Login with provided credentials
   - Verify practice management functions
   - Test SMS allocation features

3. **Verify Data Integrity**
   - Check all practices have correct types and subtypes
   - Confirm dental tariffs are properly imported
   - Validate SMS subscriptions are assigned correctly

## Support

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Verify all foreign key relationships are correct
3. Ensure RLS policies are properly configured
4. Contact support with specific error messages if needed