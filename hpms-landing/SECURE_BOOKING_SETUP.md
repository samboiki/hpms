# Secure Booking System Setup Guide

## Overview
The booking system now includes multiple security layers to prevent abuse while maintaining a good user experience.

## Security Features Implemented

### 1. ✅ Edge Function with Service Role
- All bookings go through a Supabase Edge Function
- Uses service role key to bypass RLS restrictions
- No direct database access from frontend

### 2. ✅ Rate Limiting
- Maximum 3 bookings per IP address per 15 minutes
- Prevents bot spam and abuse
- Returns 429 Too Many Requests when exceeded

### 3. ✅ Google reCAPTCHA v2
- Required for all booking submissions
- Verified server-side in Edge Function
- Using test keys for development

### 4. ✅ Input Validation
- Email format validation
- Phone number format validation  
- Future date requirement
- Required fields validation
- SQL injection prevention
- XSS attack prevention

### 5. ✅ Data Sanitization
- String length limits (50 chars max)
- Dangerous pattern detection
- HTML/Script tag stripping
- SQL keyword blocking

## Setup Instructions

### Step 1: Deploy Edge Function to Supabase

1. Login to Supabase CLI:
```bash
npx supabase login
```

2. Link your project:
```bash
cd /home/happy/projects/hpms
npx supabase link --project-ref jjxlfunlbyayxwvlpgwt
```

3. Deploy the Edge Function:
```bash
npx supabase functions deploy submit-booking
```

### Step 2: Set Up reCAPTCHA

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Create a new site with:
   - Label: "Dr. Polina Booking System"
   - reCAPTCHA type: **v2 - "I'm not a robot" Checkbox**
   - Domains: 
     - `dr-polina-landing.vercel.app`
     - `localhost` (for development)

3. Copy your keys:
   - **Site Key**: Add to `.env.local` as `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
   - **Secret Key**: Add to Supabase Edge Function environment

### Step 3: Configure Environment Variables

#### In Vercel Dashboard:
1. Go to your project settings
2. Add environment variable:
   ```
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key_here
   ```

#### In Supabase Dashboard:
1. Go to Edge Functions settings
2. Add secret:
   ```
   RECAPTCHA_SECRET_KEY=your_secret_key_here
   ```

### Step 4: Test the System

1. **Test Booking Flow**:
   - Fill out the form completely
   - Complete the CAPTCHA
   - Submit booking
   - Verify appointment appears in HPMS portal

2. **Test Rate Limiting**:
   - Try to book 4 times rapidly
   - 4th attempt should be blocked

3. **Test Validation**:
   - Submit with invalid email
   - Submit with past date
   - Submit without CAPTCHA

## Production Checklist

- [ ] Replace test reCAPTCHA keys with production keys
- [ ] Deploy Edge Function to production
- [ ] Set environment variables in production
- [ ] Test booking flow in production
- [ ] Monitor Edge Function logs
- [ ] Set up alerts for suspicious activity

## Monitoring & Maintenance

### Check Edge Function Logs:
```bash
npx supabase functions logs submit-booking --tail
```

### Monitor Rate Limit Hits:
Look for 429 responses in logs to identify potential attacks

### Review Bookings:
Regularly check for suspicious patterns:
- Multiple bookings with similar names
- Bookings with test data
- Unusual time patterns

## Emergency Procedures

### If Under Attack:

1. **Immediate Response**:
   ```sql
   -- Temporarily disable online booking
   UPDATE practices 
   SET features = jsonb_set(features, '{online_booking}', 'false') 
   WHERE slug = 'dr-polina-aesthetics';
   ```

2. **Increase Rate Limits**:
   Edit Edge Function to reduce maxRequests to 1

3. **Block IPs** (if needed):
   Add IP blacklist to Edge Function

4. **Enable Stricter CAPTCHA**:
   Switch to reCAPTCHA v3 with score threshold

## Future Enhancements

1. **Email Verification**:
   - Send confirmation email
   - Require click to confirm booking

2. **SMS Verification**:
   - Send OTP to phone number
   - Verify before confirming

3. **Appointment Limits**:
   - Max bookings per patient per week
   - Prevent far-future bookings

4. **Machine Learning**:
   - Detect booking patterns
   - Flag suspicious behavior

## Support

For issues or questions:
- Check Edge Function logs
- Review error messages
- Contact support with booking ID

Remember: Security is an ongoing process. Regularly review and update these measures based on actual usage patterns and threats.