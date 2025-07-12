# 🏥 ONEHEALTH SYSTEM BLUEPRINT V5.0 - PART 5: EDGE FUNCTIONS & COMPONENTS
**Version**: 5.0  
**Last Updated**: 2025-01-11 21:15:00 UTC

---

# SECTION A: COMPLETE EDGE FUNCTION INVENTORY

## 🚀 ACTIVE EDGE FUNCTIONS (12 Production Functions)

### 1. centralized-sms-gateway ⭐⭐⭐
**Location**: supabase/functions/centralized-sms-gateway  
**Created**: 2024-11-01 14:00:00 UTC | **Last Modified**: 2025-01-11 15:45:00 UTC  
**Deployed**: ✅ ACTIVE | **Provider**: SMSPortal

**Purpose**: Central SMS sending gateway with full tracking

**Request Structure**:
```typescript
interface SMSRequest {
  practiceId: string;
  recipientPhone: string;
  messageContent: string;
  messageType?: 'general' | 'appointment_reminder' | 'appointment_confirmation' | 
                'visit_followup' | 'birthday' | 'marketing' | 'payment_reminder' |
                'lab_results' | 'prescription' | 'emergency';
  patientId?: string;
  appointmentId?: string;
  visitId?: string;
  invoiceId?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
}
```

**Key Features**:
- Template variable replacement
- Subscription balance checking
- Character counting & segmentation
- Cost calculation
- Delivery tracking via webhooks
- Retry logic for failures
- Opt-out checking
- Quiet hours enforcement

**Database Operations**:
```sql
-- 1. Check SMS balance
SELECT credits_remaining FROM practice_sms_subscriptions WHERE practice_id = ?

-- 2. Log SMS
INSERT INTO practice_sms_logs (
  practice_id, recipient_phone, message_content, status, cost, ...
)

-- 3. Update usage
UPDATE practice_sms_subscriptions 
SET credits_used = credits_used + 1,
    credits_remaining = credits_remaining - 1
```

**Error Handling**:
- Invalid phone number format
- Insufficient credits
- Provider API failures
- Template not found
- Opt-out recipient

---

### 2. centralized-email-gateway ⭐⭐⭐
**Location**: supabase/functions/centralized-email-gateway  
**Created**: 2024-11-15 10:00:00 UTC | **Last Modified**: 2025-01-10 14:30:00 UTC  
**Deployed**: ✅ ACTIVE | **Provider**: Resend

**Purpose**: Central email sending with templates and tracking

**Request Structure**:
```typescript
interface EmailRequest {
  practiceId: string;
  recipientEmail: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  emailType?: 'general' | 'appointment' | 'invoice' | 'statement' | 
              'lab_results' | 'newsletter' | 'password_reset';
  attachments?: Array<{
    filename: string;
    content: string;  // Base64 encoded
    type: string;
  }>;
  patientId?: string;
  appointmentId?: string;
  invoiceId?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}
```

**Key Features**:
- HTML/Text dual format
- Template processing
- Attachment handling (PDFs, images)
- Open/click tracking preparation
- Bounce handling
- Unsubscribe links
- Custom headers
- DKIM signing

**Database Operations**:
```sql
-- 1. Check email balance
SELECT emails_remaining FROM practice_email_subscriptions WHERE practice_id = ?

-- 2. Log email
INSERT INTO practice_email_logs (
  practice_id, recipient_email, subject, status, ...
)

-- 3. Track engagement (future)
UPDATE practice_email_logs 
SET opened_at = ?, clicked_at = ?
```

---

### 3. process-automation-queue ⭐⭐
**Location**: supabase/functions/process-automation-queue  
**Created**: 2025-01-10 09:00:00 UTC | **Last Modified**: 2025-01-11 18:00:00 UTC  
**Deployed**: ✅ ACTIVE (with issues)

**Purpose**: Processes queued automations

**Process Flow**:
```typescript
1. Fetch pending items from automation_queue
2. Load automation_execution details
3. Load template and variables
4. For each channel (SMS/Email):
   - Process template
   - Call respective gateway
   - Update status
5. Handle failures and retries
```

**Current Issues**:
- Frontend polling with auth errors
- Should be cron-triggered
- No proper locking mechanism

**Database Operations**:
```sql
-- 1. Fetch pending
SELECT * FROM automation_queue 
WHERE status = 'queued' 
  AND scheduled_for <= NOW()
  AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
ORDER BY priority DESC, scheduled_for
LIMIT 10

-- 2. Lock items
UPDATE automation_queue 
SET locked_at = NOW(), locked_by = ?
WHERE id = ANY(?)

-- 3. Update status
UPDATE automation_executions
SET status = 'completed', completed_at = NOW()
```

---

### 4. online-booking-v2 ⭐⭐
**Location**: supabase/functions/online-booking-v2  
**Created**: 2024-12-01 11:00:00 UTC | **Last Modified**: 2025-01-08 10:00:00 UTC  
**Deployed**: ✅ ACTIVE | **Public API**

**Purpose**: Public appointment booking API

**Endpoints**:
```typescript
GET  /practices              // List practices
GET  /practices/:id          // Practice details
GET  /practices/:id/doctors  // Available doctors
GET  /practices/:id/services // Services offered
GET  /practices/:id/availability // Check slots
POST /bookings              // Create appointment
GET  /bookings/:reference   // Check booking status
POST /bookings/:reference/cancel // Cancel booking
```

**Booking Request**:
```typescript
interface BookingRequest {
  practiceId: string;
  doctorId?: string;
  patientDetails: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    idNumber?: string;
    dateOfBirth?: string;
  };
  appointmentDetails: {
    date: string;
    time: string;
    type: string;
    notes?: string;
  };
  isNewPatient: boolean;
}
```

**Security**:
- Rate limiting per IP
- CORS configuration
- Input validation
- Anti-spam measures

---

### 5. follow-up-automation-engine
**Location**: supabase/functions/follow-up-automation-engine  
**Created**: 2024-12-15 13:00:00 UTC | **Last Modified**: 2025-01-10 11:30:00 UTC  
**Deployed**: ✅ ACTIVE

**Purpose**: Schedules medical follow-ups based on conditions

**Process**:
```typescript
1. Triggered after visit completion
2. Check diagnosis codes
3. Match follow-up templates
4. Schedule follow-up messages
5. Track patient responses
```

**Follow-up Rules**:
```javascript
{
  "diabetes": [
    { days: 30, message: "glucose_check_reminder" },
    { days: 90, message: "hba1c_reminder" }
  ],
  "hypertension": [
    { days: 30, message: "bp_check_reminder" },
    { days: 180, message: "annual_review" }
  ]
}
```

---

### 6. gmail-oauth-callback
**Location**: supabase/functions/gmail-oauth-callback  
**Created**: 2024-10-20 14:00:00 UTC | **Last Modified**: 2025-01-10 09:00:00 UTC  
**Deployed**: ✅ ACTIVE

**Purpose**: Handles Gmail OAuth flow

**Flow**:
```typescript
1. Receive OAuth callback
2. Exchange code for tokens
3. Store encrypted tokens
4. Fetch user profile
5. Enable Gmail features
```

**Features Enabled**:
- Send emails via Gmail
- Read inbox for replies
- Calendar integration
- Contact sync

---

### 7. ai-search-patients
**Location**: supabase/functions/ai-search-patients  
**Created**: 2024-11-20 15:00:00 UTC | **Last Modified**: 2025-01-05 10:00:00 UTC  
**Deployed**: ✅ ACTIVE

**Purpose**: Natural language patient search

**Examples**:
```
"John diabetes" → Patients named John with diabetes
"Last week visits" → Recent visits
"Outstanding invoices Mary" → Mary's unpaid bills
```

---

### 8. generate-ai-insights
**Location**: supabase/functions/generate-ai-insights  
**Created**: 2024-12-01 16:00:00 UTC | **Last Modified**: 2025-01-10 13:00:00 UTC  
**Deployed**: ✅ ACTIVE

**Purpose**: AI-powered practice analytics

**Insights Generated**:
- Patient flow patterns
- Revenue optimization
- Appointment no-show predictions
- Service utilization
- Peak hour analysis

---

### 9. extract-text
**Location**: supabase/functions/extract-text  
**Created**: 2024-09-15 11:00:00 UTC | **Last Modified**: 2024-12-20 14:00:00 UTC  
**Deployed**: ✅ ACTIVE

**Purpose**: Extract text from documents (OCR)

**Supported Formats**:
- PDF documents
- Images (JPG, PNG)
- Scanned documents

---

### 10. execute-sql
**Location**: supabase/functions/execute-sql  
**Created**: 2024-08-01 09:00:00 UTC | **Last Modified**: 2024-11-15 10:00:00 UTC  
**Deployed**: ✅ ACTIVE | **Admin Only**

**Purpose**: Execute arbitrary SQL (dangerous!)

**Security**:
- Super admin only
- Audit logged
- Read-only by default

---

### 11. send-appointment-reminders
**Location**: supabase/functions/send-appointment-reminders  
**Created**: 2024-11-25 12:00:00 UTC | **Last Modified**: 2025-01-10 15:00:00 UTC  
**Deployed**: ✅ ACTIVE

**Purpose**: Bulk appointment reminder sending

**Schedule**: Runs daily at 14:00

---

### 12. submit-booking
**Location**: supabase/functions/submit-booking  
**Created**: 2024-12-01 11:30:00 UTC | **Last Modified**: 2025-01-08 10:30:00 UTC  
**Deployed**: ✅ ACTIVE

**Purpose**: Handles online booking submissions

---

## 🔴 DEPRECATED EDGE FUNCTIONS

### DEPRECATED Functions (Do Not Use):
1. **DEPRECATED_send-batch-email/** - Use centralized-email-gateway
2. **DEPRECATED_send-individual-email/** - Use centralized-email-gateway  
3. **DEPRECATED_webhook-processor/** - Integrated into gateways
4. **test-email-env/** - Development only
5. **test-sms-debug/** - Development only
6. **test-db-connection/** - Development only

---

# SECTION B: COMPLETE FORMS INVENTORY

## 📝 PATIENT MANAGEMENT FORMS

### 1. ModernPatientRegistrationForm.tsx ⭐⭐⭐
**Location**: src/components/forms/patients/  
**Created**: 2024-10-01 14:00:00 UTC | **Last Modified**: 2025-01-10 16:00:00 UTC  
**Used In**: Patients page, Quick registration

**Structure**:
```typescript
interface PatientFormData {
  // Basic Info
  firstName: string;
  middleName?: string;
  lastName: string;
  governmentIdNumber: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  
  // Contact
  phone: string;
  alternativePhone?: string;
  email?: string;
  
  // Address
  address: string;
  suburb?: string;
  city: string;
  postalCode?: string;
  
  // Medical
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  currentMedications?: string[];
  
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
}
```

**Features**:
- Multi-step wizard
- ID number validation
- Duplicate checking
- Photo capture
- Medical aid integration
- Auto-save draft

---

### 2. EditPatientForm.tsx
**Location**: src/components/forms/patients/  
**Created**: 2024-10-15 10:00:00 UTC | **Last Modified**: 2025-01-08 11:00:00 UTC  
**Used In**: Patient detail page

**Features**:
- All fields editable
- Change history tracking
- Validation on save
- Undo changes

---

### 3. QuickPatientForm.tsx
**Location**: src/components/forms/patients/  
**Created**: 2024-11-01 09:00:00 UTC | **Last Modified**: 2025-01-05 14:00:00 UTC  
**Used In**: Appointment booking, Walk-ins

**Minimal Fields**:
- Name
- Phone
- ID Number
- Creates full record later

---

## 📅 APPOINTMENT FORMS

### 4. PremiumAppointmentScheduler.tsx ⭐⭐⭐
**Location**: src/components/appointments/  
**Created**: 2024-12-01 13:00:00 UTC | **Last Modified**: 2025-01-11 17:00:00 UTC  
**Used In**: Dashboard, Patient profile

**Components**:
- Calendar view (react-big-calendar)
- Time slot selector
- Doctor availability checker
- Service type selector
- Duration calculator
- Conflict prevention

**Critical Logic**:
```typescript
const createAppointment = async (data: AppointmentData) => {
  // CRITICAL: Use correct fields
  const appointment = {
    patient_id: data.patientId,
    doctor_id: data.doctorId,
    visit_date: data.date,      // NOT scheduled_date!
    visit_time: data.time,      // NOT scheduled_time!
    is_scheduled: true,         // MUST be true
    status: 'scheduled',
    appointment_type: data.type,
    notes: data.notes
  };
  
  // This triggers automation
  await supabase.from('visits').insert(appointment);
};
```

---

### 5. RescheduleAppointmentModal.tsx
**Location**: src/components/modals/appointments/  
**Created**: 2024-12-10 11:00:00 UTC | **Last Modified**: 2025-01-10 10:00:00 UTC

**Features**:
- Shows original appointment
- Available slots only
- Reason for rescheduling
- Notification options

---

### 6. AppointmentDetailsModal.tsx
**Location**: src/components/modals/appointments/  
**Created**: 2024-11-15 14:00:00 UTC | **Last Modified**: 2025-01-10 12:00:00 UTC

**Shows**:
- Full appointment info
- Patient details
- History with patient
- Quick actions

---

## 🏥 VISIT/ENCOUNTER FORMS

### 7. PremiumAddVisitForm.tsx ⭐⭐⭐
**Location**: src/components/forms/visits/  
**Created**: 2024-11-01 15:00:00 UTC | **Last Modified**: 2025-01-11 14:00:00 UTC  
**Used In**: Visit recording, Queue management

**Sections**:
1. **Chief Complaint**
   - Free text
   - Common complaints dropdown
   - Duration selector

2. **History**
   - Present illness
   - Past medical history
   - Family history
   - Social history

3. **Examination**
   - System-based templates
   - Normal/abnormal toggles
   - Free text findings

4. **Assessment**
   - Diagnosis search (ICD-10)
   - Multiple diagnoses
   - Differential diagnosis

5. **Plan**
   - Medications
   - Lab orders
   - Imaging orders
   - Follow-up instructions

**Auto-saves**: Every 30 seconds

---

### 8. EditVisitForm.tsx
**Location**: src/components/forms/visits/  
**Created**: 2024-11-10 10:00:00 UTC | **Last Modified**: 2025-01-08 15:00:00 UTC

**Features**:
- Load existing visit
- Track changes
- Addendum support
- Lock after 24 hours

---

### 9. VitalsForm.tsx ⭐⭐
**Location**: src/components/forms/clinical/  
**Created**: 2024-06-01 11:00:00 UTC | **Last Modified**: 2025-01-10 13:00:00 UTC

**Measurements**:
```typescript
interface VitalsData {
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  temperature: number;
  temperatureUnit: 'celsius' | 'fahrenheit';
  respiratoryRate: number;
  oxygenSaturation: number;
  weight: number;
  weightUnit: 'kg' | 'lbs';
  height: number;
  heightUnit: 'cm' | 'inches';
  // BMI calculated automatically
  painScore?: number;
  bloodGlucose?: number;
  notes?: string;
}
```

**Features**:
- Unit conversion
- Normal range indicators
- Abnormal value alerts
- Trend charts
- Quick entry mode

---

## 💰 BILLING FORMS

### 10. InvoiceGenerationModal.tsx ⭐⭐⭐
**Location**: src/components/modals/billing/  
**Created**: 2024-07-01 14:00:00 UTC | **Last Modified**: 2025-01-11 11:00:00 UTC

**Workflow**:
1. Select patient/visit
2. Add services from tariffs
3. Apply medical aid rates
4. Add discounts
5. Calculate tax
6. Preview invoice
7. Generate PDF

**Components**:
- `ServiceSelector`
- `TariffSearch`
- `DiscountManager`
- `InvoicePreview`

---

### 11. PaymentModal.tsx
**Location**: src/components/modals/billing/  
**Created**: 2024-07-15 10:00:00 UTC | **Last Modified**: 2025-01-10 09:00:00 UTC

**Payment Methods**:
- Cash
- Credit/Debit Card
- EFT/Bank Transfer
- Medical Aid
- Cheque

**Features**:
- Split payments
- Change calculation
- Receipt printing
- Payment history

---

### 12. StatementGeneratorModal.tsx
**Location**: src/components/modals/billing/  
**Created**: 2024-08-01 11:00:00 UTC | **Last Modified**: 2025-01-05 13:00:00 UTC

**Options**:
- Date range
- Include paid/unpaid
- Detailed/Summary
- Email/Print

---

## 👥 HR & PAYROLL FORMS

### 13. AddUserModal.tsx ⭐⭐
**Location**: src/components/modals/users/  
**Created**: 2024-06-15 13:00:00 UTC | **Last Modified**: 2025-01-10 15:00:00 UTC

**Fields**:
- Personal information
- Professional details
- Employment information
- Access credentials
- Role assignment
- Department/Branch

---

### 14. EmployeeRemunerationModal.tsx ⭐⭐
**Location**: src/components/modals/payroll/  
**Created**: 2024-08-15 14:00:00 UTC | **Last Modified**: 2025-01-10 16:00:00 UTC

**Sections**:
1. **Basic Salary**
2. **Allowances**
   - Housing
   - Transport
   - Medical
   - Other
3. **Deductions**
   - Tax (PAYE)
   - Pension
   - Medical Aid
   - Loans
4. **Banking Details**
5. **Commission Structure**

---

### 15. TimesheetEntryModal.tsx
**Location**: src/components/modals/timesheets/  
**Created**: 2024-08-20 10:00:00 UTC | **Last Modified**: 2025-01-10 11:00:00 UTC

**Features**:
- Clock in/out times
- Break tracking
- Overtime calculation
- Project allocation
- GPS location (optional)

---

### 16. LeaveRequestModal.tsx
**Location**: src/components/modals/leave/  
**Created**: 2024-09-01 11:00:00 UTC | **Last Modified**: 2025-01-10 14:00:00 UTC

**Fields**:
- Leave type
- Start/End dates
- Half day options
- Reason
- Supporting documents
- Emergency contact

---

### 17. PayslipGenerationModal.tsx
**Location**: src/components/modals/payroll/  
**Created**: 2024-08-25 15:00:00 UTC | **Last Modified**: 2025-01-10 17:00:00 UTC

**Process**:
1. Select pay period
2. Select employees
3. Review calculations
4. Generate payslips
5. Email distribution

---

## 📧 COMMUNICATION FORMS

### 18. SendMessageModal.tsx ⭐⭐
**Location**: src/components/modals/communications/  
**Created**: 2024-11-01 13:00:00 UTC | **Last Modified**: 2025-01-11 10:00:00 UTC

**Features**:
- Template selection
- Variable replacement
- Character counting
- Cost preview
- Delivery scheduling
- Recipient selection

---

### 19. SendEmailModal.tsx
**Location**: src/components/modals/communications/  
**Created**: 2024-11-15 14:00:00 UTC | **Last Modified**: 2025-01-10 12:00:00 UTC

**Features**:
- Rich text editor
- Template selection
- Attachments
- CC/BCC
- Scheduling

---

### 20. BulkMessagingModal.tsx
**Location**: src/components/modals/communications/  
**Created**: 2024-12-01 10:00:00 UTC | **Last Modified**: 2025-01-10 13:00:00 UTC

**Features**:
- Patient filters
- Segmentation
- Personalization
- Approval workflow
- Cost estimation

---

## 🏥 CLINICAL FORMS

### 21. AddLabRequestForm.tsx
**Location**: src/components/forms/clinical/  
**Created**: 2024-06-20 11:00:00 UTC | **Last Modified**: 2025-01-10 10:00:00 UTC

**Features**:
- Test selection
- Panel grouping
- Urgency levels
- Clinical notes
- Fasting requirements

---

### 22. LabResultsForm.tsx
**Location**: src/components/forms/clinical/  
**Created**: 2024-06-25 14:00:00 UTC | **Last Modified**: 2025-01-10 11:00:00 UTC

**Features**:
- Result entry
- Reference ranges
- Abnormal flags
- Critical values
- Interpretation

---

### 23. ImagingRequestForm.tsx
**Location**: src/components/forms/clinical/  
**Created**: 2024-07-05 10:00:00 UTC | **Last Modified**: 2025-01-10 09:00:00 UTC

**Fields**:
- Imaging type
- Body part
- Clinical indication
- Contrast requirements
- Urgency

---

### 24. PrescriptionForm.tsx
**Location**: src/components/forms/clinical/  
**Created**: 2024-07-10 15:00:00 UTC | **Last Modified**: 2025-01-10 16:00:00 UTC

**Features**:
- Drug search
- Dosage calculator
- Interaction checking
- Refill management
- Print prescription

---

# SECTION C: SHARED COMPONENTS

## 🎨 UI COMPONENTS

### Navigation Components:
1. **AppHeader.tsx** - Main navigation bar
2. **AppSidebar.tsx** - Side navigation
3. **BreadcrumbNav.tsx** - Page navigation
4. **QuickActions.tsx** - Action shortcuts

### Data Display:
1. **DataTable.tsx** - Sortable/filterable tables
2. **Card.tsx** - Information cards
3. **StatCard.tsx** - Metric displays
4. **Timeline.tsx** - Activity timelines

### Input Components:
1. **SearchInput.tsx** - Search with suggestions
2. **DatePicker.tsx** - Date selection
3. **TimePicker.tsx** - Time selection
4. **FileUploader.tsx** - File uploads

### Feedback:
1. **Toast.tsx** - Notifications
2. **LoadingSpinner.tsx** - Loading states
3. **EmptyState.tsx** - No data states
4. **ErrorBoundary.tsx** - Error handling

---

# SECTION D: SYSTEM HEALTH & MONITORING

## 📊 Performance Metrics

### Database Performance:
- **Average Query Time**: < 100ms
- **Slow Queries**: Logged if > 500ms
- **Connection Pool**: 20 connections
- **Index Usage**: 95%+ queries use indexes

### API Performance:
- **Edge Function Cold Start**: ~500ms
- **Warm Response Time**: < 200ms
- **SMS Gateway**: 99.5% uptime
- **Email Gateway**: 99.9% uptime

### Real-time Performance:
- **Subscription Latency**: < 50ms
- **Queue Updates**: Instant
- **Chat Messages**: < 100ms

---

## 🔒 Security Measures

### Authentication:
- JWT tokens (1 hour expiry)
- Refresh tokens (7 days)
- MFA ready (not implemented)
- Session management

### Authorization:
- Row Level Security (RLS)
- Role-based access
- Practice isolation
- API rate limiting

### Data Protection:
- Encryption at rest
- TLS 1.3 in transit
- PII field encryption
- Audit logging

### Compliance:
- HIPAA considerations
- POPIA compliance ready
- Data retention policies
- Access logging

---

## 🐛 Known Issues & Workarounds

### 1. Automation Queue Processing
**Issue**: Frontend auth errors
**Workaround**: Manual processing via SQL
```sql
SELECT process_automation_queue_serverside();
```

### 2. Real-time Subscriptions
**Issue**: Connection drops on mobile
**Workaround**: Reconnection logic implemented

### 3. PDF Generation
**Issue**: Memory usage on large reports
**Workaround**: Batch processing

### 4. Search Performance
**Issue**: Slow on 100k+ patients
**Workaround**: Elasticsearch integration planned

---

## 🚀 Future Enhancements

### Planned Features:
1. **WhatsApp Business Integration**
2. **AI-powered Diagnosis Suggestions**
3. **Voice Transcription**
4. **Mobile App**
5. **Offline Mode**
6. **Advanced Analytics Dashboard**
7. **Integration with Medical Devices**
8. **Blockchain for Medical Records**

### Technical Debt:
1. Remove deprecated functions
2. Optimize database queries
3. Implement caching layer
4. Upgrade to React 19
5. Migrate to TypeScript strict mode

---

# 📝 QUICK REFERENCE COMMANDS

## Database:
```sql
-- Check automation queue
SELECT * FROM automation_queue WHERE status = 'queued' ORDER BY scheduled_for;

-- Process stuck automations
SELECT process_automation_queue_serverside();

-- Check SMS balance
SELECT * FROM practice_sms_subscriptions WHERE practice_id = ?;

-- View recent errors
SELECT * FROM automation_executions WHERE status = 'failed' ORDER BY created_at DESC;
```

## Edge Functions:
```bash
# Deploy edge function
supabase functions deploy centralized-sms-gateway

# View logs
supabase functions logs centralized-sms-gateway

# Test function
curl -X POST https://[project].supabase.co/functions/v1/centralized-sms-gateway \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"practiceId":"...", "recipientPhone":"...", "messageContent":"Test"}'
```

---

**END OF ONEHEALTH BLUEPRINT V5.0**

This comprehensive 5-part blueprint covers:
- 145 tables with complete schemas
- 47 active triggers
- 89 active functions
- 12 production edge functions
- 24+ major forms
- 14 main pages
- Complete workflows
- All with timestamps (date + time)

Total documentation: ~25,000 lines