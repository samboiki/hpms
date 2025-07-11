# 🏥 ONEHEALTH SYSTEM BLUEPRINT V5.0 - PART 4: WORKFLOWS & PAGES
**Version**: 5.0  
**Last Updated**: 2025-01-11 21:00:00 UTC

---

# SECTION A: COMPLETE PAGE INVENTORY

## 📄 ALL PAGES IN THE SYSTEM (14 Main Pages)

### 1. Dashboard.tsx
**Location**: src/pages/Dashboard.tsx  
**Created**: 2024-05-20 10:00:00 UTC | **Last Modified**: 2025-01-11 16:30:00 UTC
**Route**: `/` or `/dashboard`

**Components Used**:
- `DashboardStats` - Key metrics display
- `AppointmentCalendar` - Today's appointments
- `DoctorQueueManagement` - Live queue tracking
- `QuickActions` - Common action buttons
- `RecentActivities` - Activity feed
- `PracticeAnnouncements` - Important notices

**Key Features**:
- Real-time statistics
- Today's appointment overview
- Quick patient search
- Queue management
- Performance metrics
- Recent patient activities

---

### 2. Settings.tsx ⭐ MASSIVE PAGE
**Location**: src/pages/Settings.tsx  
**Created**: 2024-06-01 11:00:00 UTC | **Last Modified**: 2025-01-11 18:00:00 UTC
**Route**: `/settings`

**Tab Structure**:
1. **Account Tab**
2. **Users Tab** (Complete HR System)
3. **Practice Tab**
4. **Documents Tab**
5. **Social Tab**
6. **System Tab**

#### 2.1 Account Tab Components:
- `UserProfile` - Personal information
- `PasswordChange` - Security settings
- `NotificationPreferences` - Alert settings
- `ThemeSelector` - UI preferences

#### 2.2 Users Tab Components (HR SYSTEM):
- `EnhancedUserManagement` - Main HR container
  - `UserList` - Employee directory
  - `AddUserModal` - New employee form
  - `EditUserModal` - Employee editing
  - `UserRoleManagement` - Role assignments
- `DepartmentManagement` - Department structure
  - `DepartmentList` - All departments
  - `AddDepartmentModal` - Create department
  - `DepartmentHierarchy` - Org chart
- `PayrollManagement` - Complete payroll system
  - `EmployeeSalaryList` - Salary configurations
  - `EmployeeRemunerationModal` - Salary setup
  - `PayslipGeneration` - Monthly payslips
  - `PayslipViewer` - View/print payslips
  - `SalaryComponentsManager` - Benefits/deductions
  - `BulkPayslipGenerator` - Batch processing
- `TimesheetManagement` - Time tracking
  - `TimesheetCalendar` - Visual timesheet
  - `TimesheetEntryModal` - Clock in/out
  - `TimesheetApproval` - Manager approvals
  - `TimesheetReports` - Hours analysis
  - `TimesheetExcelImport` - Bulk import
  - `PDFTimesheetGenerator` - Export timesheets
- `LeaveManagement` - Leave system
  - `LeaveRequestList` - All requests
  - `LeaveRequestModal` - Apply for leave
  - `LeaveApprovalWorkflow` - Approval chain
  - `LeaveBalanceManager` - Balance tracking
  - `LeaveTypeConfiguration` - Leave types
  - `LeaveCalendar` - Visual leave planner

#### 2.3 Practice Tab Components:
- `PracticeInformation` - Basic details
- `BranchManagement` - Multi-location setup
  - `BranchList` - All branches
  - `AddBranchModal` - New branch
  - `BranchScheduleManager` - Operating hours
- `PracticeExpenses` - Expense tracking
  - `ExpenseList` - All expenses
  - `AddExpenseModal` - Record expense
  - `ExpenseCategories` - Category management
  - `ExpenseReports` - Analytics
  - `RecurringExpenses` - Automated expenses
- `PracticeInventory` - Stock management
  - `InventoryList` - All items
  - `AddInventoryModal` - New items
  - `StockAdjustment` - Stock changes
  - `LowStockAlerts` - Reorder alerts
  - `InventoryReports` - Usage analytics
- `TariffManagement` - Service pricing
  - `TariffList` - All tariffs
  - `ImportTariffsModal` - Bulk import
  - `TariffCategories` - Service categories

#### 2.4 Documents Tab Components:
- `DocumentTemplates` - Template manager
- `LetterheadDesigner` - Custom letterhead
- `PrescriptionTemplates` - Rx templates
- `ConsentForms` - Patient consent
- `ReportTemplates` - Medical reports

#### 2.5 Social Tab Components:
- `SocialMediaAccounts` - Platform connections
- `GoogleBusinessProfile` - GMB integration
- `FacebookPageManager` - FB page management
- `InstagramBusiness` - IG integration
- `ReviewManagement` - Review monitoring
  - `GoogleReviewManager` - Google reviews
  - `ReviewRequestAutomation` - Auto requests
  - `ReviewResponses` - Reply templates

#### 2.6 System Tab Components:
- `AutomationSettings` - Automation config
  - `AutomationTemplates` - Message templates
  - `TriggerConfiguration` - When to send
  - `ChannelSettings` - SMS/Email config
- `NotificationTriggers` - Alert rules
- `FollowUpAutomation` - Medical follow-ups
- `SMSConfiguration` - SMS settings
  - `SMSSubscriptionManager` - Package selection
  - `SMSUsageMonitor` - Credit tracking
  - `SMSTemplateEditor` - Message templates
- `EmailConfiguration` - Email settings
  - `EmailSubscriptionManager` - Email packages
  - `EmailTemplateEditor` - Email templates
  - `EmailSignatureManager` - Signatures
- `IntegrationSettings` - Third-party integrations
  - `GmailOAuthSettings` - Gmail connection
  - `CalendarSync` - Calendar integration
  - `ZoomIntegration` - Telemedicine

---

### 3. Patients.tsx
**Location**: src/pages/Patients.tsx  
**Created**: 2024-05-25 09:00:00 UTC | **Last Modified**: 2025-01-10 14:30:00 UTC
**Route**: `/patients`

**Components Used**:
- `PatientList` - Searchable patient directory
- `PatientSearch` - Advanced search filters
- `PatientCard` - Patient summary cards
- `ModernPatientRegistrationForm` - New patient form
- `PatientImportModal` - Bulk import
- `PatientExportModal` - Data export

**Workflows**:
1. Patient registration
2. Patient search and filtering
3. Quick actions (schedule, message, view)
4. Bulk operations

---

### 4. PatientDetail.tsx
**Location**: src/pages/PatientDetail.tsx  
**Created**: 2024-06-01 10:30:00 UTC | **Last Modified**: 2025-01-11 15:45:00 UTC
**Route**: `/patients/:id`

**Tab Components**:
1. **Overview Tab**:
   - `PatientHeader` - Demographics
   - `PatientSummary` - Key info
   - `RecentVisits` - Last visits
   - `UpcomingAppointments` - Future appointments
   - `PatientAlerts` - Important notices

2. **Medical History Tab**:
   - `VisitHistory` - All visits
   - `ChronicConditions` - Ongoing conditions
   - `Allergies` - Allergy list
   - `CurrentMedications` - Active meds

3. **Appointments Tab**:
   - `AppointmentHistory` - Past appointments
   - `ScheduleNewAppointment` - Quick booking
   - `AppointmentAnalytics` - Patterns

4. **Clinical Records Tab**:
   - `VitalSignsChart` - Vitals trends
   - `LabResultsViewer` - Lab history
   - `ImagingResults` - Radiology
   - `ClinicalNotes` - Doctor notes

5. **Documents Tab**:
   - `DocumentLibrary` - All documents
   - `DocumentUploadModal` - Upload files
   - `DocumentViewer` - Preview docs

6. **Billing Tab**:
   - `PatientInvoices` - Invoice history
   - `PaymentHistory` - Payments
   - `OutstandingBalance` - Due amounts
   - `StatementGenerator` - Statements

7. **Communications Tab**:
   - `MessageHistory` - SMS/Email log
   - `SendMessageModal` - Send message
   - `CommunicationPreferences` - Opt-in/out

**Special Components**:
- `PatientDetailQueue` - Doctor's queue widget
- `QuickActionsPanel` - Common actions
- `PatientTimeline` - Activity timeline

---

### 5. Encounters.tsx (Visits)
**Location**: src/pages/Encounters.tsx  
**Created**: 2024-07-01 11:00:00 UTC | **Last Modified**: 2025-01-10 16:00:00 UTC
**Route**: `/encounters` or `/visits`

**Components Used**:
- `VisitList` - All visits table
- `VisitFilters` - Advanced filtering
- `VisitStats` - Visit analytics
- `PremiumAddVisitForm` - New visit form
- `EditVisitForm` - Edit existing visit
- `VisitTemplates` - Quick templates

**Workflows**:
1. Recording new visits
2. Updating visit information
3. Adding clinical notes
4. Ordering tests
5. Generating invoices

---

### 6. Finance.tsx
**Location**: src/pages/Finance.tsx  
**Created**: 2024-07-15 14:00:00 UTC | **Last Modified**: 2025-01-11 12:30:00 UTC
**Route**: `/finance`

**Sub-Routes & Components**:

#### 6.1 `/finance/overview`:
- `FinancialDashboard` - Revenue overview
- `RevenueChart` - Income trends
- `ExpenseChart` - Expense trends
- `ProfitabilityAnalysis` - P&L summary
- `CashFlowWidget` - Cash position

#### 6.2 `/finance/invoices`:
- `InvoiceList` - All invoices
- `InvoiceFilters` - Search/filter
- `CreateInvoiceModal` - New invoice
- `InvoiceViewer` - View/print invoice
- `BulkInvoiceActions` - Batch operations

#### 6.3 `/finance/payments`:
- `PaymentList` - Payment history
- `RecordPaymentModal` - Record payment
- `PaymentMethods` - Payment types
- `PaymentReconciliation` - Matching

#### 6.4 `/finance/medical-aid`:
- `BatchManagement` - Claim batches
- `BatchList` - All batches
- `CreateBatchModal` - New batch
- `BatchSubmission` - Submit claims
- `BatchTracking` - Status tracking
- `RejectionManagement` - Handle rejections

#### 6.5 `/finance/reports`:
- `FinancialReports` - Report center
- `AgeingAnalysis` - Debtor aging
- `ServiceAnalysis` - Service revenue
- `DoctorRevenue` - Provider income
- `TaxReports` - Tax summaries

---

### 7. Communications.tsx
**Location**: src/pages/Communications.tsx  
**Created**: 2024-11-01 10:00:00 UTC | **Last Modified**: 2025-01-11 17:00:00 UTC
**Route**: `/communications`

**Main Components**:
- `CommunicationsDashboard` - Overview stats
- `MessagingTabs` - Tab navigation

**Tab Components**:

#### 7.1 Messaging Tab:
- `EnhancedMessagingV2` - Internal messaging
  - `ConversationList` - Chat threads
  - `MessageComposer` - Send messages
  - `MessageSearch` - Search messages
  - `TeamChannels` - Group chats
  - `DirectMessages` - 1-on-1 chats

#### 7.2 Patient Communications Tab:
- `PatientMessaging` - Patient comms
  - `SMSComposer` - Send SMS
  - `EmailComposer` - Send emails
  - `BulkMessaging` - Mass messages
  - `MessageTemplates` - Quick templates
  - `DeliveryTracking` - Status tracking

#### 7.3 Automations Tab:
- `SmartAutomations` - Automation center
  - `AutomationList` - All automations
  - `AutomationBuilder` - Create flows
  - `AutomationAnalytics` - Performance
  - `AutomationLogs` - Execution history

#### 7.4 Analytics Tab:
- `CommunicationAnalytics` - Insights
  - `DeliveryStatsDashboard` - SMS/Email stats
  - `EngagementMetrics` - Open rates
  - `CostAnalysis` - Communication costs
  - `PatientEngagement` - Response rates

#### 7.5 Telemedicine Tab:
- `TelemedicineHub` - Video consults
  - `UpcomingConsults` - Schedule
  - `TelemedicineRoom` - Video room
  - `ConsultationNotes` - Session notes
  - `RecordingManager` - Session recordings

---

### 8. Inventory.tsx
**Location**: src/pages/Inventory.tsx  
**Created**: 2024-08-01 13:00:00 UTC | **Last Modified**: 2025-01-10 11:30:00 UTC
**Route**: `/inventory`

**Components Used**:
- `InventoryDashboard` - Stock overview
- `InventoryList` - Item catalog
- `StockLevels` - Current stock
- `AddInventoryItemModal` - New items
- `StockAdjustmentModal` - Adjust stock
- `StockMovements` - Transaction history
- `ReorderAlerts` - Low stock alerts
- `SupplierManagement` - Suppliers
- `PurchaseOrders` - Order management
- `InventoryReports` - Usage reports
- `ExpiryTracking` - Expiry monitoring
- `StockTakeModal` - Physical counts

**Workflows**:
1. Adding new inventory items
2. Stock adjustments (in/out)
3. Reorder management
4. Expiry tracking
5. Stock taking

---

### 9. BillingWorkflow.tsx
**Location**: src/pages/BillingWorkflow.tsx  
**Created**: 2024-09-01 15:00:00 UTC | **Last Modified**: 2025-01-10 13:45:00 UTC
**Route**: `/billing-workflow`

**Step Components**:
1. `PatientSelection` - Choose patient
2. `ServiceSelection` - Add services
3. `TariffApplication` - Apply pricing
4. `DiscountManager` - Apply discounts
5. `InvoicePreview` - Review invoice
6. `PaymentCollection` - Record payment
7. `InvoiceFinalization` - Complete process

**Features**:
- Step-by-step billing guide
- Medical aid integration
- Multiple payment methods
- Invoice generation
- Receipt printing

---

### 10. Messages.tsx (Legacy)
**Location**: src/pages/Messages.tsx  
**Created**: 2024-06-15 12:00:00 UTC | **Last Modified**: 2024-12-01 09:00:00 UTC
**Route**: `/messages`
**Status**: Being replaced by Communications page

**Components**:
- `MessageInbox` - Message list
- `MessageComposer` - Send messages
- `MessageTemplates` - Templates

---

### 11. EnhancedPracticeProfile.tsx
**Location**: src/pages/EnhancedPracticeProfile.tsx  
**Created**: 2024-10-15 11:00:00 UTC | **Last Modified**: 2025-01-10 15:00:00 UTC
**Route**: `/practice-profile`

**Components**:
- `PracticeHeader` - Logo & name
- `PracticeInfo` - Contact details
- `OpeningHours` - Business hours
- `DoctorProfiles` - Staff profiles
- `ServicesList` - Services offered
- `LocationMap` - Google Maps
- `PhotoGallery` - Practice photos
- `PatientReviews` - Google reviews
- `OnlineBookingWidget` - Appointments
- `SocialMediaLinks` - Social profiles

**Purpose**: Public-facing practice profile

---

### 12. AdminPractices.tsx
**Location**: src/pages/AdminPractices.tsx  
**Created**: 2024-11-01 14:00:00 UTC | **Last Modified**: 2025-01-10 10:00:00 UTC
**Route**: `/admin/practices`
**Access**: Super admin only

**Components**:
- `PracticeList` - All practices
- `PracticeFilters` - Search/filter
- `AddPracticeModal` - New practice
- `EditPracticeModal` - Edit practice
- `PracticeStats` - Usage metrics
- `SubscriptionManager` - Plans
- `PracticeToggle` - Enable/disable

---

### 13. AdminTariffs.tsx
**Location**: src/pages/AdminTariffs.tsx  
**Created**: 2024-11-15 10:00:00 UTC | **Last Modified**: 2025-01-10 09:30:00 UTC
**Route**: `/admin/tariffs`
**Access**: Admin roles

**Components**:
- `TariffList` - All tariffs
- `TariffCategories` - Categories
- `ImportTariffsModal` - Bulk import
- `TariffEditor` - Edit pricing
- `MedicalAidMapping` - MA codes
- `TariffHistory` - Price history

---

### 14. Login.tsx
**Location**: src/pages/Login.tsx  
**Created**: 2024-05-15 08:00:00 UTC | **Last Modified**: 2025-01-08 11:00:00 UTC
**Route**: `/login`

**Components**:
- `LoginForm` - Credentials input
- `ForgotPassword` - Reset password
- `RememberMe` - Session persistence
- `PracticeSelector` - Multi-practice

---

# SECTION B: COMPLETE WORKFLOWS

## 🔄 WORKFLOW 1: PATIENT JOURNEY

### 1.1 Patient Registration
**Last Updated**: 2025-01-11 19:00:00 UTC

**Step-by-Step Process**:
1. **Navigate to Patients**
   - Route: `/patients`
   - Click: "Add Patient" button
   - Opens: `ModernPatientRegistrationForm`

2. **Fill Patient Information**
   - **Tab 1: Basic Information**
     - First/Middle/Last Name
     - ID Number (validated)
     - Date of Birth
     - Gender
     - Contact details
   - **Tab 2: Contact Information**
     - Phone numbers
     - Email
     - Physical address
     - Postal address
   - **Tab 3: Medical Aid**
     - Provider selection
     - Plan/Scheme
     - Member number
     - Main member details
   - **Tab 4: Next of Kin**
     - Emergency contact name
     - Relationship
     - Contact numbers

3. **Database Operations**
   ```sql
   -- Triggers fired:
   1. assign_system_patient_reference_number_trigger
   2. audit_patients_trigger
   3. patient_created_automation_trigger (if enabled)
   ```

4. **Post-Registration Actions**
   - Patient receives welcome SMS (if automation enabled)
   - Patient appears in searchable list
   - Can immediately book appointment

**Components Involved**:
- `ModernPatientRegistrationForm`
- `MedicalAidForm`
- `NextOfKinForm`
- `PatientSearch`

**Tables Modified**:
- `patients` (INSERT)
- `medical_aid_details` (INSERT)
- `next_of_kin` (INSERT)
- `automation_executions` (INSERT if automation)
- `audit_logs` (INSERT)

---

### 1.2 Appointment Booking
**Last Updated**: 2025-01-11 19:15:00 UTC

**Step-by-Step Process**:
1. **Open Scheduler**
   - From: Dashboard or Patient Profile
   - Component: `PremiumAppointmentScheduler`
   - Shows: Calendar with available slots

2. **Select Date & Time**
   - Click on calendar date
   - View available time slots
   - Check doctor availability
   - Select preferred slot

3. **Enter Appointment Details**
   ```javascript
   {
     patient_id: "selected_patient_uuid",
     doctor_id: "selected_doctor_uuid",
     visit_date: "2025-01-12",  // CRITICAL: Not scheduled_date
     visit_time: "14:30",       // CRITICAL: Not scheduled_time
     is_scheduled: true,        // MUST be true for appointments
     appointment_type: "consultation",
     notes: "First time consultation"
   }
   ```

4. **Save Appointment**
   - Insert into `visits` table
   - Triggers:
     - `generate_visit_number` → "V-20250112-0001"
     - `appointment_automation_trigger` → Creates automation

5. **Automation Flow**
   ```sql
   -- Created records:
   1. automation_executions (trigger: appointment.created)
   2. automation_queue (scheduled for confirmation)
   3. automation_queue (scheduled for reminder)
   ```

6. **Real-time Updates**
   - Calendar refreshes for all users
   - Patient receives confirmation SMS
   - Appointment appears in queue

**Components Involved**:
- `PremiumAppointmentScheduler`
- `Calendar` (react-big-calendar)
- `PatientSearchSelect`
- `AppointmentDetailsModal`

**Tables Modified**:
- `visits` (INSERT)
- `automation_executions` (INSERT)
- `automation_queue` (INSERT x2)
- `audit_logs` (INSERT)

---

### 1.3 Patient Check-in & Queue
**Last Updated**: 2025-01-11 19:30:00 UTC

**Step-by-Step Process**:
1. **Patient Arrives**
   - Receptionist opens Dashboard
   - Component: `DoctorQueueManagement`
   - Finds patient in today's appointments

2. **Check-in Patient**
   - Click "Check In" button
   - Updates:
     ```sql
     UPDATE visits SET 
       status = 'checked_in',
       check_in_time = NOW()
     WHERE id = :visit_id
     ```

3. **Mark as Ready**
   - After vitals/prep
   - Click "Ready" button
   - Updates:
     ```sql
     UPDATE visits SET 
       status = 'ready',
       ready_time = NOW(),
       queue_number = :next_queue_number
     ```

4. **Doctor's View**
   - Component: `PatientDetailQueue`
   - Shows: "My Queue Today"
   - Real-time updates via subscription

5. **Start Visit**
   - Doctor clicks "Start Visit"
   - Updates:
     ```sql
     UPDATE visits SET 
       status = 'in_progress',
       start_time = NOW()
     ```
   - Navigates to patient profile

**Components Involved**:
- `DoctorQueueManagement`
- `PatientDetailQueue`
- `QueueStatusCard`
- `QueuePatientCard`

**Real-time Subscriptions**:
```javascript
// Subscription to visits table
supabase
  .channel('queue-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'visits',
    filter: `visit_date=eq.${today}`
  }, handleQueueUpdate)
  .subscribe()
```

---

## 🔄 WORKFLOW 2: CLINICAL DOCUMENTATION

### 2.1 Recording Vitals
**Last Updated**: 2025-01-11 19:45:00 UTC

**Step-by-Step Process**:
1. **Open Vitals Form**
   - From: Patient profile or visit
   - Component: `VitalsForm`
   - Can be done by nurse before doctor

2. **Enter Measurements**
   ```javascript
   {
     blood_pressure_systolic: 120,
     blood_pressure_diastolic: 80,
     heart_rate: 72,
     temperature: 36.8,
     respiratory_rate: 16,
     oxygen_saturation: 98,
     weight: 75.5,
     height: 175,
     // BMI calculated automatically
   }
   ```

3. **Save Vitals**
   - Insert into `vitals` table
   - Triggers:
     - `calculate_bmi_trigger`
     - `flag_abnormal_vitals_trigger`

4. **Abnormal Values**
   - System highlights abnormal readings
   - Creates alert for doctor
   - Adds to patient alerts

**Components Involved**:
- `VitalsForm`
- `VitalsTrendChart`
- `AbnormalVitalsAlert`

**Tables Modified**:
- `vitals` (INSERT)
- `audit_logs` (INSERT)

---

### 2.2 Clinical Visit Documentation
**Last Updated**: 2025-01-11 20:00:00 UTC

**Step-by-Step Process**:
1. **During Consultation**
   - Component: `PremiumAddVisitForm` or `EditVisitForm`
   - Tabs: History, Examination, Diagnosis, Plan

2. **Document Chief Complaint**
   ```javascript
   {
     chief_complaint: "Persistent headache for 3 days",
     history_of_present_illness: "Started gradually...",
     review_of_systems: "No fever, no vision changes..."
   }
   ```

3. **Physical Examination**
   - Structured templates available
   - Body system checklists
   - Abnormal findings highlighted

4. **Assessment & Plan**
   ```javascript
   {
     diagnosis: "Tension headache",
     diagnosis_codes: ["G44.2"],
     treatment_plan: "1. Paracetamol 500mg TDS\n2. Rest...",
     follow_up_instructions: "Return if symptoms worsen"
   }
   ```

5. **Order Tests (Optional)**
   - Lab Orders → `AddLabRequestForm`
   - Imaging → `ImagingRequestForm`
   - Creates separate request records

6. **Complete Visit**
   - Click "Complete Visit"
   - Updates:
     ```sql
     UPDATE visits SET 
       status = 'completed',
       completed_at = NOW(),
       completed_by = :doctor_id
     ```

**Components Involved**:
- `PremiumAddVisitForm`
- `EditVisitForm`
- `ClinicalTemplates`
- `DiagnosisSearch` (ICD-10)

**Tables Modified**:
- `visits` (UPDATE)
- `lab_requests` (INSERT if ordered)
- `imaging_requests` (INSERT if ordered)
- `audit_logs` (INSERT)

---

## 🔄 WORKFLOW 3: BILLING & INVOICING

### 3.1 Invoice Generation
**Last Updated**: 2025-01-11 20:15:00 UTC

**Step-by-Step Process**:
1. **Trigger Invoice Creation**
   - From: Visit completion or manual
   - Component: `InvoiceGenerationModal`
   - Pre-populated with visit services

2. **Select Services**
   - Component: `ServiceSelector`
   - Search tariffs by code/name
   - Add multiple services
   - Auto-calculates totals

3. **Apply Medical Aid (if applicable)**
   - Select medical aid provider
   - Enter authorization number
   - System splits patient/MA portions

4. **Review & Adjust**
   ```javascript
   {
     services: [
       {
         tariff_code: "0190",
         description: "Consultation",
         quantity: 1,
         unit_price: 650.00,
         medical_aid_rate: 520.00
       }
     ],
     discount_percentage: 10,
     tax_percentage: 15
   }
   ```

5. **Generate Invoice**
   - Insert into `invoices_enhanced`
   - Insert into `invoice_services`
   - Triggers:
     - `assign_system_transaction_number_trigger`
     - `auto_assign_invoice_to_batch_trigger` (if MA)

6. **Post-Generation Actions**
   - Print/Email invoice
   - If medical aid: Added to batch
   - Patient receives invoice notification

**Components Involved**:
- `InvoiceGenerationModal`
- `ServiceSelector`
- `TariffSearch`
- `InvoicePreview`
- `InvoiceViewer`

**Tables Modified**:
- `invoices_enhanced` (INSERT)
- `invoice_services` (INSERT multiple)
- `batch_details` (INSERT if MA)
- `audit_logs` (INSERT)

---

### 3.2 Medical Aid Batch Processing
**Last Updated**: 2025-01-11 20:30:00 UTC

**Step-by-Step Process**:
1. **Automatic Batching**
   - MA invoices auto-assigned to open batch
   - Function: `get_or_create_active_batch_id()`
   - One batch per MA provider

2. **Batch Management**
   - Route: `/finance/medical-aid`
   - Component: `BatchManagement`
   - View batch contents

3. **Close Batch**
   - Click "Close Batch"
   - No more invoices can be added
   - Validates all required fields

4. **Generate Submission**
   - Click "Generate File"
   - Creates EDI/CSV file
   - Updates batch_submissions table

5. **Submit to Medical Aid**
   - Download submission file
   - Email to medical aid
   - Mark as submitted

6. **Track Responses**
   - Update batch with response
   - Process rejections
   - Update invoice statuses

**Components Involved**:
- `BatchManagement`
- `BatchList`
- `BatchDetailsModal`
- `BatchSubmissionModal`
- `RejectionHandler`

**Tables Modified**:
- `batch_headers` (UPDATE)
- `batch_details` (INSERT/UPDATE)
- `batch_submissions` (INSERT)
- `batch_trailer` (INSERT)

---

## 🔄 WORKFLOW 4: HR & PAYROLL

### 4.1 Employee Onboarding
**Last Updated**: 2025-01-11 20:45:00 UTC

**Step-by-Step Process**:
1. **Add New Employee**
   - Route: `/settings` → Users tab
   - Component: `AddUserModal`
   - Fill employee details

2. **Create User Account**
   ```javascript
   {
     email: "nurse@clinic.com",
     first_name: "Jane",
     last_name: "Doe",
     role: "nurse",
     department_id: "nursing_dept_uuid",
     employment_type: "full_time",
     hire_date: "2025-01-01"
   }
   ```

3. **Setup Salary**
   - Component: `EmployeeRemunerationModal`
   - Configure:
     - Base salary
     - Allowances
     - Deductions
     - Banking details

4. **Assign to Department**
   - Component: `DepartmentManagement`
   - Set reporting structure
   - Assign to branch

5. **Configure Leave**
   - Set leave balances
   - Annual leave allocation
   - Leave types available

**Components Involved**:
- `AddUserModal`
- `EmployeeRemunerationModal`
- `DepartmentAssignment`
- `LeaveBalanceSetup`

**Tables Modified**:
- `users` (INSERT)
- `employee_salaries` (INSERT)
- `leave_balances` (INSERT)
- `user_practice_assignments` (INSERT)

---

### 4.2 Timesheet Management
**Last Updated**: 2025-01-11 21:00:00 UTC

**Step-by-Step Process**:
1. **Daily Time Entry**
   - Component: `TimesheetCalendar`
   - Click on date
   - Opens: `TimesheetEntryModal`

2. **Clock In/Out**
   ```javascript
   {
     work_date: "2025-01-11",
     clock_in: "08:00",
     clock_out: "17:30",
     break_start: "13:00",
     break_end: "13:30",
     // Hours calculated automatically
   }
   ```

3. **Submit Timesheet**
   - End of pay period
   - Click "Submit for Approval"
   - Status: `submitted`

4. **Manager Approval**
   - Component: `TimesheetApproval`
   - Review hours
   - Approve/Reject with comments

5. **Integration with Payroll**
   - Approved timesheets → Payslip generation
   - Overtime calculated
   - Leave days deducted

**Components Involved**:
- `TimesheetCalendar`
- `TimesheetEntryModal`
- `TimesheetApproval`
- `TimesheetReports`
- `PDFTimesheetGenerator`

**Tables Modified**:
- `timesheets` (INSERT/UPDATE)
- `timesheet_entries` (INSERT)
- `audit_logs` (INSERT)

---

### 4.3 Payroll Processing
**Last Updated**: 2025-01-11 21:15:00 UTC

**Step-by-Step Process**:
1. **Monthly Payroll Run**
   - Route: `/settings` → Users → Payroll
   - Component: `PayrollManagement`
   - Select pay period

2. **Calculate Salaries**
   - Base from `employee_salaries`
   - Add overtime from timesheets
   - Add bonuses/commissions
   - Deduct leave without pay

3. **Generate Payslips**
   - Component: `BulkPayslipGenerator`
   - For all active employees
   - Calculates:
     - Gross earnings
     - Tax (PAYE)
     - Deductions
     - Net pay

4. **Review & Approve**
   - Preview all payslips
   - Make adjustments
   - Approve batch

5. **Distribution**
   - Email payslips (via email gateway)
   - Generate bank file
   - Update YTD totals

**Components Involved**:
- `PayrollManagement`
- `PayslipGeneration`
- `PayslipViewer`
- `BulkPayslipGenerator`
- `PayrollReports`

**Tables Modified**:
- `payslips` (INSERT)
- `payslip_items` (INSERT multiple)
- `practice_email_logs` (INSERT)

---

## 🔄 WORKFLOW 5: COMMUNICATION & AUTOMATION

### 5.1 SMS Automation Setup
**Last Updated**: 2025-01-11 21:30:00 UTC

**Step-by-Step Process**:
1. **Configure Automation**
   - Route: `/settings` → System → Automation
   - Component: `AutomationSettings`
   - Enable triggers

2. **Appointment Reminder Example**
   ```javascript
   {
     trigger_type: "appointment.reminder",
     timing: "24_hours_before",
     channels: ["sms"],
     template_id: "appointment_reminder_template",
     skip_weekends: true,
     send_time: "14:00"
   }
   ```

3. **Template Setup**
   - Component: `SMSTemplateEditor`
   - Variables: {{patientName}}, {{appointmentTime}}
   - Preview with real data

4. **Trigger Flow**
   ```sql
   -- When appointment created:
   1. appointment_automation_trigger fires
   2. Creates automation_execution
   3. Calls queue_automation_intelligently()
   4. Creates automation_queue entry
   5. Scheduled for optimal time
   ```

5. **Processing**
   - Edge function: `process-automation-queue`
   - Fetches pending items
   - Calls `centralized-sms-gateway`
   - Updates execution status

6. **Monitoring**
   - Component: `AutomationLogs`
   - View success/failure
   - Delivery reports
   - Cost tracking

**Components Involved**:
- `AutomationSettings`
- `AutomationTemplates`
- `SMSTemplateEditor`
- `AutomationLogs`
- `DeliveryStatsDashboard`

**Tables Modified**:
- `practice_automation_settings` (UPDATE)
- `automation_templates` (INSERT/UPDATE)
- `sms_templates` (INSERT/UPDATE)
- `automation_executions` (INSERT)
- `automation_queue` (INSERT)
- `practice_sms_logs` (INSERT)

---

This is Part 4 covering all pages and major workflows. Continue with Part 5 for remaining workflows and edge functions?