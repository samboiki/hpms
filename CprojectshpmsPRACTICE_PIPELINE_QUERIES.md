# Practice Pipeline - Useful Queries

## Overview
All 866 practices have been imported with status='lead' and are ready to be managed through the Practice Pipeline.

---

## SQL Queries for Practice Management

### 1. Get All Leads
```sql
SELECT 
  id, name, contact_email, contact_phone, city, 
  settings->>'discipline_name' as discipline,
  settings->>'practice_number' as practice_number
FROM practices
WHERE status = 'lead'
ORDER BY name;
```

### 2. Get Leads by Practice Type
```sql
SELECT 
  p.id, p.name, p.contact_email, p.city,
  pt.name as practice_type
FROM practices p
JOIN practice_types pt ON p.practice_type_id = pt.id
WHERE p.status = 'lead' AND pt.name = 'dental'
ORDER BY p.name;
```

### 3. Get Leads by City/Location
```sql
SELECT 
  id, name, contact_email, contact_phone,
  settings->>'discipline_name' as discipline
FROM practices
WHERE status = 'lead' AND city = 'Windhoek'
ORDER BY name;
```

### 4. Search Practices by Name
```sql
SELECT 
  id, name, contact_email, contact_phone, city, status
FROM practices
WHERE status = 'lead' AND name ILIKE '%dental%'
ORDER BY name;
```

### 5. Get Leads with Valid Email Addresses
```sql
SELECT 
  id, name, contact_email, contact_phone, city
FROM practices
WHERE status = 'lead' 
  AND contact_email IS NOT NULL 
  AND contact_email != ''
ORDER BY name;
```

### 6. Get Leads with Valid Phone Numbers
```sql
SELECT 
  id, name, contact_email, contact_phone, city
FROM practices
WHERE status = 'lead' 
  AND contact_phone IS NOT NULL 
  AND contact_phone != ''
ORDER BY name;
```

### 7. Count Leads by Practice Type
```sql
SELECT 
  pt.name as practice_type,
  COUNT(*) as lead_count
FROM practices p
JOIN practice_types pt ON p.practice_type_id = pt.id
WHERE p.status = 'lead'
GROUP BY pt.name
ORDER BY lead_count DESC;
```

### 8. Count Leads by City
```sql
SELECT 
  city,
  COUNT(*) as lead_count
FROM practices
WHERE status = 'lead' AND city IS NOT NULL
GROUP BY city
ORDER BY lead_count DESC;
```

### 9. Update Practice Status (Move Through Pipeline)
```sql
-- Move a practice from 'lead' to 'contacted'
UPDATE practices
SET status = 'contacted', updated_at = NOW()
WHERE id = 'practice-uuid-here';

-- Move to 'qualified'
UPDATE practices
SET status = 'qualified', updated_at = NOW()
WHERE id = 'practice-uuid-here';

-- Move to 'onboarding'
UPDATE practices
SET status = 'onboarding', updated_at = NOW()
WHERE id = 'practice-uuid-here';

-- Activate the practice
UPDATE practices
SET status = 'active', updated_at = NOW()
WHERE id = 'practice-uuid-here';
```

### 10. Get Pipeline Status Summary
```sql
SELECT 
  status,
  COUNT(*) as count
FROM practices
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'lead' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'qualified' THEN 3
    WHEN 'onboarding' THEN 4
    WHEN 'active' THEN 5
    WHEN 'inactive' THEN 6
  END;
```

---

## JavaScript/Supabase Client Queries

### 1. Get All Leads (JavaScript)
```javascript
const { data: leads, error } = await supabase
  .from('practices')
  .select(`
    id, 
    name, 
    contact_email, 
    contact_phone, 
    city,
    settings,
    practice_types(name)
  `)
  .eq('status', 'lead')
  .order('name');
```

### 2. Search Practices (JavaScript)
```javascript
const { data: results, error } = await supabase
  .from('practices')
  .select('*')
  .eq('status', 'lead')
  .ilike('name', '%dental%');
```

### 3. Filter by Practice Type (JavaScript)
```javascript
// First get the practice type ID
const { data: practiceType } = await supabase
  .from('practice_types')
  .select('id')
  .eq('name', 'dental')
  .single();

// Then get practices of that type
const { data: leads } = await supabase
  .from('practices')
  .select('*')
  .eq('status', 'lead')
  .eq('practice_type_id', practiceType.id);
```

### 4. Update Practice Status (JavaScript)
```javascript
const { data, error } = await supabase
  .from('practices')
  .update({ 
    status: 'contacted',
    updated_at: new Date().toISOString()
  })
  .eq('id', practiceId);
```

### 5. Get Pipeline Statistics (JavaScript)
```javascript
const { data: stats, error } = await supabase
  .rpc('get_pipeline_statistics'); // Custom RPC function

// Or manually:
const statuses = ['lead', 'contacted', 'qualified', 'onboarding', 'active'];
const counts = {};

for (const status of statuses) {
  const { count } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);
  counts[status] = count;
}
```

---

## Practice Pipeline Status Flow

```
┌──────────┐     ┌────────────┐     ┌────────────┐     ┌─────────────┐     ┌────────┐
│   LEAD   │ --> │ CONTACTED  │ --> │ QUALIFIED  │ --> │ ONBOARDING  │ --> │ ACTIVE │
└──────────┘     └────────────┘     └────────────┘     └─────────────┘     └────────┘
   (866)              (0)                (0)                 (0)              (7)
```

### Status Definitions:
- **lead**: Initial contact/interest (866 practices imported)
- **contacted**: Practice has been reached out to
- **qualified**: Practice meets criteria and interested
- **onboarding**: Practice is in setup/training process
- **active**: Practice is fully operational on the system
- **inactive**: Practice was active but is now paused

---

## Practice Data Structure

### Settings JSONB Field Contains:
```json
{
  "discipline_code": "54",
  "discipline_name": "DENTIST",
  "practice_number": "540000452750"
}
```

### Available Fields in Practices Table:
- `id` (UUID)
- `slug` (unique identifier)
- `name` (practice name)
- `contact_email`
- `contact_phone`
- `address`
- `city`
- `country` (all set to 'Namibia')
- `status` (lead/contacted/qualified/onboarding/active/inactive)
- `practice_type_id` (foreign key to practice_types)
- `settings` (JSONB - contains discipline info)
- `created_at`
- `updated_at`

---

## Tips for Working with the Data

1. **Searching**: Use ILIKE for case-insensitive searches in PostgreSQL
2. **Filtering**: Always include status in queries to focus on relevant practices
3. **Joining**: Use practice_types table to get human-readable type names
4. **Settings**: Access discipline data via `settings->>'discipline_name'`
5. **Updates**: Always update `updated_at` when changing practice data
6. **Validation**: Check for NULL values in contact_email and contact_phone

---

## Next Steps for Sales Team

1. **Prioritize Leads**: 
   - Start with practices that have valid email addresses
   - Focus on specific practice types (e.g., dental, medical)
   - Target practices in major cities first

2. **Contact Strategy**:
   - Email campaigns to practices with valid emails
   - Phone outreach to practices with valid numbers
   - Track all communications

3. **Status Updates**:
   - Move contacted practices to 'contacted' status
   - Qualify interested practices
   - Begin onboarding for qualified practices

4. **Metrics to Track**:
   - Conversion rate: lead → contacted
   - Conversion rate: contacted → qualified
   - Conversion rate: qualified → active
   - Average time in each stage
   - Geographic distribution of conversions

---

**All 866 practices are ready to be managed through the Practice Pipeline!**
