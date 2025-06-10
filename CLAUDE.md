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

### MCP Supabase Integration (ACTIVE) ✅
```bash
# MCP Server is configured and ready to use
# Configuration: ~/.config/Claude/claude_desktop_config.json
# Test connection: node test-mcp-connection.js
```

**MCP Features Available:**
- **Direct Database Queries**: Query any table with SQL
- **Schema Operations**: List tables, describe structure
- **Data Operations**: Insert, update, delete records
- **Real-time Access**: Live connection to HPMS database
- **Service Role Access**: Full database permissions

**Usage Examples:**
- "Show me all tables in the database"
- "Count patients in the practice_tariffs table"
- "Describe the structure of the appointments table"
- "Query recent visits with patient details"

### CRITICAL: bolt.new-Style Database Access (ALWAYS USE THIS)
```bash
# MANDATORY: Always use direct PostgreSQL connection for database operations
node execute-migrations-like-bolt.js    # Execute any database operations with direct DB access
```

**Direct PostgreSQL Configuration (SET IN STONE):**
- URL: https://jjxlfunlbyayxwvlpgwt.supabase.co
- Database Password: T@ngisasa200
- Connection String: postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres

**This is the ONLY method that works - direct PostgreSQL connection bypasses ALL restrictions**

### Document Upload System (PRODUCTION READY) ✅

**Working Solution for Supabase Storage:**

The document upload system is fully functional with the following setup:

#### **Database Setup**
- `patient_documents` table exists with proper structure
- RLS policies configured for authenticated users
- Storage bucket `documents` created and accessible

#### **Authentication Requirements**
```javascript
// CRITICAL: Always use session-based authentication for uploads
const { data: { session }, error } = await supabase.auth.getSession();

// Check session validity
if (!session || !session.user) {
  throw new Error('Authentication required for uploads');
}

// Session provides access token for S3 authentication
console.log('Session token:', session.access_token);
```

#### **Storage Configuration**
- **Bucket Name**: `documents` (lowercase, exact spelling)
- **Bucket Type**: Public bucket for listing visibility
- **File Size Limit**: 50MB
- **Supported Types**: PDF, Images, Word docs, Excel, Text files

#### **Required Storage Policies**
Execute these in Supabase Dashboard > Authentication > Policies:

**For storage.buckets table:**
```sql
-- Allow authenticated users to see buckets
CREATE POLICY "Allow bucket listing" ON storage.buckets 
FOR SELECT USING (auth.role() = 'authenticated');
```

**For storage.objects table:**
```sql
-- Upload policy
CREATE POLICY "Allow document uploads" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Read policy  
CREATE POLICY "Allow document reads" ON storage.objects 
FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Delete policy
CREATE POLICY "Allow document deletes" ON storage.objects 
FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Update policy
CREATE POLICY "Allow document updates" ON storage.objects 
FOR UPDATE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
```

#### **Upload Implementation**
```javascript
// Correct upload flow
const fileExt = file.name.split('.').pop();
const fileName = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

const { data, error } = await supabase.storage
  .from('documents')
  .upload(fileName, file, {
    cacheControl: '3600',
    upsert: false
  });
```

#### **Key Success Factors**
1. **Session Authentication**: Use `getSession()` not `getUser()`
2. **Bucket Visibility**: Storage policies must allow bucket listing
3. **Skip Bucket Checks**: Don't verify bucket existence, just upload
4. **Error Handling**: Specific error messages for different failure types
5. **User Login**: Ensure users are properly authenticated before upload

#### **Testing Procedure**
1. Log in with: `admin@onehealth.local` / `admin123`
2. Navigate to PatientModernDetail > Documents tab
3. Upload any supported file type
4. Verify file appears in storage and database
5. Check browser console for detailed logs

#### **Troubleshooting**
- **"Bucket not found"**: Check storage policies on storage.buckets
- **"RLS violation"**: Check storage policies on storage.objects  
- **"Auth required"**: Verify user session is valid
- **"Upload failed"**: Check file size and type restrictions

### Database Operation Methods (MANDATORY APPROACH)
1. **ALWAYS use direct PostgreSQL connection** with password
2. **Use execute-migrations-like-bolt.js** for all database operations  
3. **Direct database access** exactly like bolt.new does
4. **Never repeat manual operations** - automate everything
5. **This method bypasses ALL RLS policies and restrictions**

**Example bolt.new-style operation:**
```javascript
// ✅ CORRECT: Direct PostgreSQL connection (WORKS EVERY TIME)
import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
await client.connect();
await client.query('INSERT INTO practices ...');

// ❌ WRONG: Service role or anon key - unreliable
const supabase = createClient(url, key);
const { error } = await supabase.from('practices').insert(data); // FAILS
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

6. **Core Design Principles**:
- Premium Quality: Every interface should feel polished and production-ready
- Beautiful, Not Generic: Avoid cookie-cutter designs; add unique touches
- Fully Featured: Include all necessary functionality, not just MVP
- Professional Healthcare UI: Clean, trustworthy, efficient and very very premium.

7. **Testing Approach**
- Use React Testing Library for component tests
- Mock Supabase client for unit tests
- Test user flows, not implementation details
- Ensure forms validate correctly
- Test error states and edge cases

8. **Deployment Checklist**
- Environment variables configured
- Supabase RLS policies reviewed
- Build passes without warnings
- All forms have proper validation
- Error boundaries implemented
- Loading states for all async operations
- Mobile responsive design verified
- Performance metrics acceptable

9. **Important Notes**
- Always use TypeScript strict mode
- Handle all possible error states
- Add loading indicators for better UX
- Test on mobile devices
- Keep bundle size optimized
- Follow React best practices
- Document complex business logic

10. **Resources & References**
Internal Documentation

Database schema: /supabase/schema.sql
API types: /src/types/database.ts
Component library: /src/components/ui/
Custom hooks: /src/hooks/

11. **External Resources**
Supabase Docs
React Query Docs
Tailwind CSS Docs
Lucide Icons
React Hook Form

12. **Design Inspiration**
Healthcare UIs: Look at modern EMR systems
Dashboard patterns: Check Tailwind UI
Data tables: Reference enterprise SaaS products
Mobile patterns: Study native healthcare apps

13. **Final Reminders**
Always prioritize user experience - Healthcare professionals are busy
Make it beautiful - Every interaction should feel premium
Performance matters - Fast load times save lives
Accessibility is crucial - Healthcare must be inclusive
Test thoroughly - Healthcare software must be reliable

## CRITICAL WORKFLOW REQUIREMENT - SET IN STONE
After EVERY change/prompt, you MUST:
1. Run `npm run dev` to test changes
2. Commit ALL changes with descriptive message
3. Push to dev branch (`git push origin dev`)

This is NON-NEGOTIABLE and MANDATORY after EVERY modification.

Common Workflows
14. **Explore › Plan › Confirm › Code › Commit**
Task: Figure out issue 
Action: Propose a few fixes.
Note: iterate  approach before you begin coding.

15. Write Tests › Commit › Code › Iterate › Commit
Task: Write tests for file
Purpose: Ensure links render properly.
Note: Tests will not pass initially since links aren’t yet implemented.
Action:
Write and commit the tests.
Update the code to make the tests pass.

16. Write Code › Screenshot Result › Iterate
Task: Implement the features
Action:
Screenshot the result using Puppeteer. 
Iterate until it visually matches the mock.


### Core Tables and Relationships

#### patients
- id (uuid, PK)
- first_name (text)
- last_name (text)
- email (text)
- cell_number (text)
- date_of_birth (date)
- gender (text)
- id_number (text)
- address (text)
- city (text)
- state_province (text)
- postal_code (text)
- country (text, default: 'Namibia')
- occupation (text)
- employer (text)
- marital_status (text)
- emergency_contact_name (text)
- emergency_contact_phone (text)
- emergency_contact_relationship (text)
- created_at (timestamp)
- updated_at (timestamp)

#### visits
- id (uuid, PK)
- patient_id (uuid, FK -> patients.id)
- visit_date (date)
- visit_time (time)
- chief_complaint (text) - main symptoms/complaints
- history_of_present_illness (text)
- diagnosis (text)
- treatment_plan (text)
- follow_up_instructions (text)
- doctor_id (uuid, FK -> auth.users.id)
- status (text)
- created_at (timestamp)

#### appointments
- id (uuid, PK)
- patient_id (uuid, FK -> patients.id)
- doctor_id (uuid, FK -> auth.users.id)
- appointment_date (date)
- appointment_time (time)
- duration (integer) - in minutes
- type (text) - consultation, follow-up, procedure
- status (text) - scheduled, confirmed, cancelled, completed
- notes (text)
- created_at (timestamp)

#### medical_records
- id (uuid, PK)
- patient_id (uuid, FK -> patients.id)
- visit_id (uuid, FK -> visits.id)
- record_type (text)
- diagnosis (text)
- treatment (text)
- prescriptions (jsonb)
- doctor_notes (text)
- attachments (jsonb)
- created_at (timestamp)

#### lab_results
- id (uuid, PK)
- patient_id (uuid, FK -> patients.id)
- visit_id (uuid, FK -> visits.id)
- lab_request_id (uuid, FK -> lab_requests.id)
- test_name (text)
- result_value (text)
- unit (text)
- reference_range (text)
- abnormal_flag (text)
- status (text)
- performed_at (timestamp)
- result_date (timestamp)

#### medical_aid_details
- id (uuid, PK)
- patient_id (uuid, FK -> patients.id)
- provider (text)
- scheme_name (text)
- scheme_type (text)
- member_number (text)
- main_member_name (text)
- main_member_id_number (text)
- relationship_to_main_member (text)
- dependent_code (text)
- valid_from (date)
- valid_to (date)

#### vitals
- id (uuid, PK)
- visit_id (uuid, FK -> visits.id)
- blood_pressure_systolic (integer)
- blood_pressure_diastolic (integer)
- heart_rate (integer)
- respiratory_rate (integer)
- temperature (numeric)
- weight (numeric)
- height (numeric)
- bmi (numeric)
- oxygen_saturation (integer)
- recorded_at (timestamp)

### Common Query Patterns

#### Find patients by symptom
```sql
SELECT DISTINCT p.* 
FROM patients p
JOIN visits v ON v.patient_id = p.id
WHERE v.chief_complaint ILIKE '%symptom%'
ORDER BY p.first_name, p.last_name;
```

#### Patients with active medical aid
```sql
SELECT p.*, m.provider, m.scheme_name 
FROM patients p
LEFT JOIN medical_aid_details m ON m.patient_id = p.id
WHERE m.valid_to >= CURRENT_DATE OR m.valid_to IS NULL
ORDER BY p.first_name, p.last_name;
```

#### Recent visits with vitals
```sql
SELECT v.*, p.first_name, p.last_name, vt.*
FROM visits v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN vitals vt ON vt.visit_id = v.id
WHERE v.visit_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY v.visit_date DESC, v.visit_time DESC;
```

### Edge Functions Available
- **ai-search-patients**: Converts natural language queries to SQL using GPT-4o-mini
- **extract-text**: OCR/text extraction from uploaded documents

### Database Best Practices
- Always use ILIKE for case-insensitive text searches
- Use DISTINCT when joining visits/appointments to avoid duplicate patients
- Age calculation: `EXTRACT(YEAR FROM AGE(date_of_birth))`
- Date comparisons: Use proper date functions, not string comparisons
- Always include ORDER BY for consistent results
- Use proper indexes on foreign keys and commonly searched fields

## Appointment Management Features

### Available Utilities (src/utils/appointments.ts)

1. **Time Slot Generation**
   - `generateTimeSlots(date, doctorId, businessHours)`: Creates available appointment slots
   - Respects business hours and lunch breaks
   - Marks slots as unavailable if appointments exist
   - Default: 30-minute slots, 8am-5pm with 12pm-1pm lunch

2. **Conflict Checking**
   - `checkAppointmentConflict(doctorId, scheduledTime, duration, excludeId)`: Validates time availability
   - Prevents double-booking
   - Excludes cancelled appointments

3. **Finding Next Available Slot**
   - `findNextAvailableSlot(doctorId, startDate, businessHours, maxDays)`: Smart slot finder
   - Searches up to 30 days ahead
   - Returns first available future slot

4. **Rescheduling**
   - `rescheduleAppointment(appointmentId, newTime, reason)`: Safe appointment rescheduling
   - Validates new time availability
   - Updates appointment with optional reason

5. **Statistics**
   - `getAppointmentStats(doctorId?, dateRange?)`: Dashboard metrics
   - Returns total, completed, pending, cancelled, no-show counts
   - Calculates completion rate percentage

6. **Bulk Operations**
   - `bulkUpdateAppointmentStatus(appointmentIds, status)`: Mass status updates
   - Useful for end-of-day processing

### Appointment Modal Components

1. **RescheduleAppointmentModal**
   - Quick reschedule options (next day, 3 days, next week)
   - Calendar date picker with available slots
   - Conflict prevention
   - Optional reason for rescheduling
   - Handles both scheduled_time and date/time formats

### Updated Appointments Page Features
- Real-time doctor list from users table (no more hardcoded names)
- Statistics cards showing key metrics
- Enhanced search by patient, doctor, or appointment type
- Complete month view implementation
- Reschedule functionality for scheduled appointments
- Proper appointment status workflow