# OneHealth Administration System - Login Instructions

## 🔐 Admin Account Access

### Default Admin Accounts

After running the migration and setup scripts, the following admin accounts will be available:

#### 1. Super Administrator
- **Email:** `admin@onehealth.com.na`
- **Password:** `OneHealth2025!Admin`
- **Role:** Super Administrator
- **Permissions:** Full system access including:
  - Practice management (read/write/delete)
  - User management (read/write/delete)
  - Billing management (read/write)
  - SMS management and plan administration
  - System reports and exports
  - Admin user management

#### 2. Practice Manager
- **Email:** `manager@onehealth.com.na`
- **Password:** `Manager2025!`
- **Role:** Practice Manager
- **Permissions:**
  - Practice management (read/write)
  - User management (read/write, no delete)
  - Billing access (read only)
  - SMS management (read/write, no plan changes)
  - Reports and exports

#### 3. Billing Administrator
- **Email:** `billing@onehealth.com.na`
- **Password:** `Billing2025!`
- **Role:** Billing Administrator
- **Permissions:**
  - Practice information (read only)
  - Full billing management
  - SMS plan management
  - Financial reports and exports

#### 4. Support Agent
- **Email:** `support@onehealth.com.na`
- **Password:** `Support2025!`
- **Role:** Support Agent
- **Permissions:**
  - Read-only access to practices and users
  - Basic reports (no export)
  - Support ticket management

---

## 🚨 CRITICAL SECURITY REQUIREMENTS

### Immediate Actions Required After Setup:

1. **Change All Default Passwords**
   - Log in with each account immediately after setup
   - Change all default passwords to strong, unique passwords
   - Use a password manager to store new credentials securely

2. **Enable Two-Factor Authentication**
   - Implement 2FA for all admin accounts
   - Use authenticator apps like Google Authenticator or Authy

3. **Review and Update Permissions**
   - Audit the default permissions for each role
   - Adjust permissions based on your organization's needs
   - Create additional roles if needed

4. **Set Up Proper Email Addresses**
   - Update email addresses to match your organization's domain
   - Ensure email addresses are monitored and secure

---

## 🔧 System Setup Instructions

### 1. Database Migration
Run the following SQL scripts in order in your Supabase SQL editor:

```sql
-- 1. Apply the main migration
-- Execute: supabase/migrations/20250605000000_comprehensive_practice_management_system.sql

-- 2. Create admin accounts
-- Execute: create_onehealth_super_admin.sql

-- 3. Import dental tariff data
-- Execute: import_comprehensive_dental_tariffs.sql
```

### 2. Verify Installation
After running the scripts, verify the setup:

```sql
-- Check admin accounts
SELECT email, full_name, r.name as role, is_active 
FROM onehealth_admins a
JOIN admin_roles r ON r.id = a.role_id
ORDER BY a.created_at;

-- Check tariff data
SELECT 
  COUNT(*) as total_tariffs,
  COUNT(DISTINCT category) as categories,
  practice_type
FROM practice_tariffs 
GROUP BY practice_type;

-- Check SMS plans
SELECT name, monthly_sms_limit, price_per_month 
FROM sms_plans 
WHERE is_active = true;
```

### 3. Authentication Integration
The system includes a `verify_admin_login()` function for authentication:

```sql
-- Example login verification
SELECT * FROM verify_admin_login('admin@onehealth.com.na', 'OneHealth2025!Admin');
```

---

## 📊 System Features Overview

### Practice Management
- **Multi-tenant Practice Support:** Each practice has isolated data
- **Comprehensive Tariff System:** Dental, medical, aesthetic services
- **Business Hours and Settings:** Configurable per practice
- **Branding and Customization:** Logos, colors, custom domains

### SMS Management
- **Usage Tracking:** Real-time SMS usage monitoring
- **Plan Management:** Multiple subscription tiers
- **Template System:** Customizable message templates
- **Analytics Dashboard:** Delivery rates and cost analysis

### Reporting and Analytics
- **Practice Performance Dashboard:** Key metrics and KPIs
- **Financial Reports:** Revenue analysis and projections
- **User Activity Analytics:** Staff engagement tracking
- **Cross-Practice Comparison:** Benchmarking and insights
- **SMS Analytics:** Usage patterns and optimization

### Administrative Features
- **Role-Based Access Control:** Granular permissions system
- **Activity Logging:** Complete audit trail
- **User Management:** Staff and practice administration
- **System Configuration:** Global settings and preferences

---

## 🔍 Quick Start Verification

### 1. Login Test
1. Access your admin portal
2. Try logging in with the Super Administrator account
3. Verify dashboard loads with practice data
4. Check all menu items are accessible

### 2. Practice Data Verification
1. Navigate to Practice Management
2. Confirm both test practices are visible:
   - City Clinic Windhoek
   - Coastal Medical Center
3. Verify tariff data is loaded
4. Check SMS subscription status

### 3. Reporting Test
1. Access the Reports section
2. Generate a Practice Performance Dashboard report
3. Verify data appears correctly
4. Test export functionality (if available)

---

## 🆘 Troubleshooting

### Common Issues:

1. **Login Failed**
   - Verify email and password are correct
   - Check if account is locked (locked_until field)
   - Ensure account is active (is_active = true)

2. **Missing Data**
   - Verify all migration scripts ran successfully
   - Check for any SQL errors in the logs
   - Confirm practice_id associations are correct

3. **Permission Errors**
   - Review role permissions in admin_roles table
   - Check user's role_id assignment
   - Verify RLS policies are correctly applied

4. **SMS Features Not Working**
   - Confirm SMS portal configuration
   - Check practice SMS subscription status
   - Verify API credentials are set

---

## 📞 Support and Maintenance

### Regular Maintenance Tasks:
- Monitor admin activity logs
- Review and update user permissions
- Check SMS usage and billing
- Backup admin configuration data
- Update passwords regularly

### Security Monitoring:
- Monitor failed login attempts
- Review admin activity logs
- Check for suspicious access patterns
- Audit permission changes

---

## 📋 Post-Setup Checklist

- [ ] All admin accounts created successfully
- [ ] Default passwords changed for all accounts
- [ ] Email addresses updated to organization domain
- [ ] Two-factor authentication enabled
- [ ] Practice data verified
- [ ] Tariff data loaded correctly
- [ ] SMS system configured
- [ ] Reporting dashboards functional
- [ ] User permissions reviewed and adjusted
- [ ] Backup procedures established
- [ ] Security monitoring implemented

---

**Last Updated:** June 5, 2025  
**System Version:** 2.0  
**Migration ID:** 20250605000000_comprehensive_practice_management_system

For technical support or additional configuration, refer to the system documentation or contact your database administrator.