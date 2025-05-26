# Deploy Edge Function - Simple Steps

## Quick Deploy (5 minutes)

### Step 1: Open Supabase Dashboard
Click this link: [Open Functions Dashboard](https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/functions)

### Step 2: Create New Function
1. Click the **"New Function"** button
2. Enter name: `submit-booking`
3. Click **"Create function"**

### Step 3: Copy Function Code
Copy ALL the code from this file:
```
/home/happy/projects/hpms/supabase/functions/submit-booking/index.ts
```

### Step 4: Paste and Configure
1. Replace the default code with your copied code
2. Click **"Save"**

### Step 5: Add Environment Variable
1. Go to the **"Settings"** tab
2. Click **"Add secret"**
3. Add:
   - Name: `RECAPTCHA_SECRET_KEY`
   - Value: `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe` (test key)

### Step 6: Deploy
Click **"Deploy"** button

## That's it! ✅

Your secure booking system is now active with:
- ✅ Rate limiting (3 bookings/15 min per IP)
- ✅ CAPTCHA verification
- ✅ Input validation
- ✅ Anti-bot protection

## Test Your Booking System

Visit: https://dr-polina-landing-m62mu51ky-onehealth.vercel.app

Try booking an appointment - you should see:
1. CAPTCHA checkbox appears
2. Form validates your input
3. Successful booking creates appointment in HPMS

## Troubleshooting

If bookings fail:
1. Check Edge Function logs in Supabase dashboard
2. Verify RECAPTCHA_SECRET_KEY is set
3. Ensure function is deployed (green status)

## Production Checklist

When ready for real patients:
1. Get production reCAPTCHA keys from Google
2. Update RECAPTCHA_SECRET_KEY in Supabase
3. Update NEXT_PUBLIC_RECAPTCHA_SITE_KEY in Vercel