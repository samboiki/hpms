# HPMS - Complete System Analysis

## Overview
Healthcare Practice Management System (HPMS) is a comprehensive multi-tenant practice management platform with advanced features for medical practices.

---

## COMPLETE PAGE INVENTORY

### 1. **Dashboard** (`/src/pages/Dashboard.tsx`)
**Purpose:** Main landing page with practice overview and quick actions

#### Components Used:
- `PremiumStatCard` - Dynamic stats cards with gradients
- `PremiumAppointmentScheduler` - Appointment booking system
- `NotificationsPanel` - Real-time notifications
- `FloatingVisitTracker` - Floating visit tracking widget
- `ComprehensivePatientModal` - Patient details modal
- `AppointmentGridView` - Grid view of appointments
- `FullScreenEditVisitModal` - Visit editing modal
- `AppointmentDetailsModal` - Appointment details viewer
- `RescheduleAppointmentModal` - Reschedule appointments
- `AppointmentActionModal` - Quick appointment actions
- `AppointmentApprovalModal` - Approve/reject appointments

#### Key Features:
- **Real-time Stats**: Patients, Communications, Encounters, Finance
- **Calendar View**: Month/Week/Day views with timeline/grid modes
- **Quick Search**: Global patient/appointment search
- **Activity Feed**: Recent practice activities
- **Avatar Dropdown**: User profile management

#### Database Operations:
- `users` - Fetch practice doctors
- `patients` - Load patient statistics
- `visits` - Real-time appointment tracking
- `invoices_enhanced` - Financial statistics
- Real-time subscriptions for live updates

#### Workflows:
1. **Appointment Management**:
   - View today's appointments
   - Confirm/reject bookings
   - Start/complete visits
   - Reschedule appointments
   
2. **Quick Actions**:
   - Add new appointment
   - View patient details
   - Access financial reports
   - Navigate to other modules

---

### 2. **Settings** (`/src/pages/Settings.tsx`) - MASSIVE MULTI-TAB PAGE
**Purpose:** Comprehensive practice configuration center

#### Main Tabs:

##### A. **Account Tab**
- **Profile Management**: User avatar, name, email updates
- **Preferences**: Language, timezone, notifications
- **Security**: Password changes, 2FA, session management

##### B. **Users Tab** (HR Management)
**Components:**
- `EnhancedUserManagement` - Main user management
- `PayrollManagement` - Complete payroll system
- `TimesheetManagement` - Timesheet tracking
- `LeaveManagement` - Leave requests/approvals
- `EmployeeRemunerationModal` - Salary configuration
- `TimesheetEntryModal` - Clock in/out
- `LeaveTypeModal` - Configure leave types
- `ExcelTimesheetManagement` - Excel import/export
- Various PDF generators for timesheets

**HR Features:**
- Employee onboarding
- Salary structure management
- Payslip generation
- Timesheet tracking with calendar view
- Leave balance management
- Leave request workflow
- Attendance reports
- Excel timesheet imports

##### C. **Practice Tab**
**Sub-tabs:**
1. **Profile**: Practice info, logo, contact details
2. **Hours**: Operating hours per day
3. **Branches**: Multi-location management (`BranchManagement`)
4. **Expenses**: Practice overhead tracking (`PracticeExpenses`)
5. **Departments**: Department management (`DepartmentManagement`)
6. **Inventory**: Stock management (`PracticeInventory`)

##### D. **Documents Tab**
- Document upload/download
- Categories: Forms, Templates, Policies
- Version control
- Access permissions

##### E. **Social Tab**
**Features:**
- Social media account integration
- OAuth app management
- Platform configurations:
  - Instagram
  - Facebook
  - LinkedIn
  - X (Twitter)
  - YouTube
  - Gmail OAuth
- API credentials management
- Posting permissions
- Rate limiting settings

##### F. **System Tab**
- Platform information
- Support contacts
- System health checks
- Feature toggles

---

### 3. **Patients** (`/src/pages/Patients.tsx`)
**Purpose:** Patient management and records

#### Components:
- Patient list with search/filters
- Add/Edit patient forms
- Patient detail cards
- Medical history viewer

#### Features:
- Advanced search (name, ID, phone)
- Filter by gender, age, status
- Bulk actions
- Export patient lists
- Quick add patient

---

### 4. **PatientDetail** (`/src/pages/PatientDetail.tsx`)
**Purpose:** Comprehensive patient profile and medical records

#### Components:
- Patient demographics
- Visit history timeline
- Medical records tabs
- Lab results viewer
- Prescription history
- Billing information
- Documents storage

#### Features:
- Complete medical history
- Visit notes and diagnoses
- Lab/imaging results
- Prescription tracking
- Insurance information
- Payment history

---

### 5. **Encounters** (`/src/pages/Encounters.tsx`)
**Purpose:** Clinical visit management

#### Features:
- Active visits dashboard
- Visit workflow tracking
- Clinical notes entry
- Diagnosis coding
- Prescription management
- Lab/imaging orders

---

### 6. **Finance** (`/src/pages/Finance.tsx`)
**Purpose:** Financial management and reporting

#### Tabs:
1. **Overview**: Financial KPIs and charts
2. **Invoicing**: Invoice generation
3. **Payments**: Payment tracking
4. **Income**: Revenue analysis
5. **Expenses**: Expense tracking
6. **Reports**: Financial reports
7. **Accounting**: GL integration
8. **Batch Management**: Medical aid batch processing

#### Components:
- Revenue charts (line, bar, pie)
- Invoice management
- Payment reconciliation
- Batch submission system
- Financial KPI cards

#### Features:
- Monthly revenue trends
- Payment status tracking
- Medical aid batch processing
- Service-wise revenue analysis
- Practitioner performance metrics

---

### 7. **BillingWorkflow** (`/src/pages/BillingWorkflow.tsx`)
**Purpose:** Streamlined billing process

#### Features:
- Step-by-step billing wizard
- Service selection
- Medical aid verification
- Invoice generation
- Payment collection

---

### 8. **Communications** (`/src/pages/Communications.tsx`)
**Purpose:** Unified communication center

#### Tabs:
1. **Dashboard**: Communication overview
2. **Messaging**: Internal messaging system
3. **Automations**: Smart workflows
4. **Telemedicine**: Virtual consultations

#### Components:
- `CommunicationsDashboard` - Stats overview
- `EnhancedMessagingV2` - Internal messaging
- `SmartAutomations` - Automation workflows
- `TelemedicineRoom` - Video consultations
- `DeliveryStatsDashboard` - SMS/Email tracking

#### Features:
- SMS/Email tracking
- Appointment reminders
- Internal team chat
- Patient messaging
- Automation builder
- Telemedicine sessions

---

### 9. **Messages** (`/src/pages/Messages.tsx`)
**Purpose:** Legacy messaging page (being replaced by Communications)

---

### 10. **Inventory** (`/src/pages/Inventory.tsx`)
**Purpose:** Medical supplies and equipment tracking

#### Features:
- Stock level monitoring
- Low stock alerts
- Reorder management
- Expiry tracking
- Supplier management
- Stock movement history

#### Components:
- Inventory stats cards
- Stock list table
- Add/Edit item forms
- Restock modal
- Report generation

---

### 11. **EnhancedPracticeProfile** (`/src/pages/EnhancedPracticeProfile.tsx`)
**Purpose:** Public-facing practice profile

#### Features:
- Practice information display
- Service listings
- Doctor profiles
- Operating hours
- Contact information
- Location map

---

### 12. **Admin Pages**

#### A. **PracticesManagement** (`/src/pages/admin/PracticesManagement.tsx`)
- Multi-practice administration
- Practice onboarding
- Subscription management
- Usage monitoring

#### B. **TariffManagement** (`/src/pages/admin/TariffManagement.tsx`)
- Medical tariff configuration
- Pricing rules
- Medical aid rates
- Service pricing

---

### 13. **Authentication**

#### **Login** (`/src/pages/auth/Login.tsx`)
- Email/password authentication
- Social login options
- Password recovery
- Remember me functionality

---

### 14. **Test Pages** (Development)
- `TestCommunication.tsx`
- `TestSMSSend.tsx`
- `TestSMSDirectSend.tsx`
- `TestSMSWithAuth.tsx`
- `WorkingSMSTest.tsx`

---

## KEY COMPONENTS NOT IN PAGES

### Review Management
- `GoogleReviewManager` (`/src/components/reviews/GoogleReviewManager.tsx`)
  - Google Business integration
  - Review request automation
  - Review tracking
  - SMS/Email review requests

### HR Components (in Settings > Users)
- Complete payroll system
- Timesheet management
- Leave management
- Employee records
- Salary processing

### Communication Services
- Centralized SMS gateway
- Centralized email gateway
- Delivery tracking
- Subscription management
- Usage analytics

---

## DATABASE OPERATIONS SUMMARY

### Core Tables:
1. **practices** - Multi-tenant base
2. **users** - Staff/employee records
3. **patients** - Patient demographics
4. **visits** - Appointments/encounters
5. **invoices_enhanced** - Billing records
6. **medical_records** - Clinical data
7. **timesheets** - Employee time tracking
8. **leave_requests** - HR leave management
9. **payslips** - Payroll records
10. **practice_sms_logs** - SMS tracking
11. **practice_email_logs** - Email tracking
12. **inventory_items** - Stock management
13. **departments** - Practice departments
14. **branches** - Multi-location support

---

## WORKFLOWS SUMMARY

### 1. **Patient Journey**
- Registration → Appointment → Check-in → Consultation → Billing → Follow-up

### 2. **HR Workflow**
- Onboarding → Timesheet → Leave Management → Payroll → Payslip

### 3. **Communication Flow**
- Trigger → Gateway → Logging → Delivery → Analytics

### 4. **Billing Workflow**
- Service Entry → Medical Aid Check → Invoice → Payment → Reconciliation

### 5. **Inventory Flow**
- Purchase → Stock In → Usage → Low Stock Alert → Reorder

---

## FORMS AND MODALS

### Major Forms:
1. **Patient Registration Form**
2. **Appointment Booking Form**
3. **Visit/Encounter Form**
4. **Invoice Generation Form**
5. **Employee Onboarding Form**
6. **Timesheet Entry Form**
7. **Leave Request Form**
8. **Inventory Item Form**
9. **Social Media Configuration Form**
10. **Practice Settings Form**

### Key Modals:
1. **Patient Details Modal**
2. **Appointment Actions Modal**
3. **Invoice Preview Modal**
4. **Payslip Preview Modal**
5. **Document Upload Modal**
6. **Communication Preview Modal**
7. **Visit Edit Modal**
8. **Employee Remuneration Modal**

---

## INTEGRATIONS

### External Services:
1. **SMSPortal** - SMS delivery
2. **Resend** - Email delivery
3. **Google OAuth** - Gmail integration
4. **Social Media APIs** - Multiple platforms
5. **Medical Aid Systems** - Claims processing
6. **Supabase** - Backend services
7. **Telemedicine** - Video consultations

---

## MISSING/UPCOMING FEATURES

1. **Pharmacy Integration**
2. **Laboratory Integration**
3. **Radiology/Imaging Integration**
4. **Medical Aid Real-time Verification**
5. **Advanced Analytics Dashboard**
6. **Mobile App**
7. **Patient Portal**
8. **Referral Management**
9. **Clinical Decision Support**
10. **Automated Insurance Claims**