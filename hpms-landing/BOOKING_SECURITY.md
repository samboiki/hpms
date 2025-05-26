# Booking Security Implementation

## Current Security Measures

### 1. Edge Function with Service Role
- Uses Supabase Edge Function with service role key
- Bypasses RLS policies safely
- No direct database access from frontend

### 2. Rate Limiting
- Maximum 3 bookings per IP per 15 minutes
- Prevents bot spam and abuse
- Returns 429 Too Many Requests when exceeded

### 3. Input Validation
- Email format validation
- Phone number format validation
- Future date requirement
- Required fields validation
- SQL injection prevention
- XSS attack prevention

### 4. Data Sanitization
- String length limits (50 chars for names)
- Dangerous pattern detection
- HTML/Script tag stripping
- SQL keyword blocking

### 5. Conflict Prevention
- Checks for existing time slots
- Prevents double booking
- Practice availability verification

## Additional Security Recommendations

### 1. Add CAPTCHA (High Priority)
```typescript
// Install: npm install react-google-recaptcha
import ReCAPTCHA from "react-google-recaptcha";

// In your form:
<ReCAPTCHA
  sitekey="YOUR_RECAPTCHA_SITE_KEY"
  onChange={setCaptchaToken}
/>

// Verify on backend:
const verifyRecaptcha = async (token: string) => {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${RECAPTCHA_SECRET}&response=${token}`
  });
  const data = await response.json();
  return data.success;
};
```

### 2. Email Verification
```sql
-- Add to patients table
ALTER TABLE patients ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE patients ADD COLUMN verification_token TEXT;
ALTER TABLE patients ADD COLUMN verification_sent_at TIMESTAMP;

-- Only allow verified patients to book more appointments
CREATE POLICY "Limit unverified bookings" ON appointments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients 
      WHERE id = appointments.patient_id 
      AND (email_verified = true OR (
        SELECT COUNT(*) FROM appointments 
        WHERE patient_id = patients.id
      ) < 1)
    )
  );
```

### 3. Honeypot Field
```tsx
// Add invisible field to catch bots
<input
  type="text"
  name="website"
  style={{ display: 'none' }}
  tabIndex={-1}
  autoComplete="off"
  value={honeypot}
  onChange={(e) => setHoneypot(e.target.value)}
/>

// Reject if honeypot is filled
if (honeypot) {
  throw new Error('Bot detected');
}
```

### 4. Browser Fingerprinting
```typescript
// Use a library like FingerprintJS
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const fp = await FingerprintJS.load();
const result = await fp.get();
const visitorId = result.visitorId;

// Track bookings per visitor ID
```

### 5. Webhook Notifications
```typescript
// Send booking notifications to admin
const sendBookingNotification = async (booking: any) => {
  await fetch('YOUR_WEBHOOK_URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `New booking: ${booking.name} - ${booking.email}`,
      suspicious: booking.flags
    })
  });
};
```

### 6. Database Cleanup
```sql
-- Scheduled function to clean old temporary patients
CREATE OR REPLACE FUNCTION cleanup_temp_patients()
RETURNS void AS $$
BEGIN
  DELETE FROM patients 
  WHERE id_number LIKE 'TEMP-%' 
  AND created_at < NOW() - INTERVAL '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM appointments 
    WHERE patient_id = patients.id 
    AND status IN ('scheduled', 'confirmed', 'completed')
  );
END;
$$ LANGUAGE plpgsql;

-- Run daily
SELECT cron.schedule('cleanup-temp-patients', '0 2 * * *', 'SELECT cleanup_temp_patients();');
```

## Deployment Steps

1. **Deploy Edge Function**:
   ```bash
   supabase functions deploy submit-booking
   ```

2. **Update Environment Variables**:
   - Set RECAPTCHA_SECRET in Supabase dashboard
   - Configure SMTP for email verification

3. **Monitor & Alerts**:
   - Set up alerts for unusual booking patterns
   - Monitor rate limit hits
   - Track failed validation attempts

## Testing

1. **Rate Limit Test**:
   - Try booking 4 times from same IP
   - Should fail on 4th attempt

2. **Validation Test**:
   - Submit with invalid email
   - Submit with past date
   - Submit with SQL injection attempts

3. **Load Test**:
   - Use tool like k6 or artillery
   - Ensure system handles concurrent bookings

## Emergency Response

If under attack:
1. Temporarily disable online booking
2. Increase rate limits
3. Add IP blacklisting
4. Enable CAPTCHA immediately
5. Review logs for patterns