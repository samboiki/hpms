# Resend Email Setup Instructions

## ✅ Step 1: Your Resend Configuration

You've already signed up and got your API key:
```
RESEND_API_KEY = re_PhLVbTmf_N8JutXwWmzdckjTMdY2knugK
```

## 🔧 Step 2: Set Secrets in Supabase

1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/settings/functions
2. Scroll down to **Secrets** section
3. Add these secrets:

```
RESEND_API_KEY = re_PhLVbTmf_N8JutXwWmzdckjTMdY2knugK
SENDER_EMAIL = onboarding@resend.dev
```

**Note**: For now, use `onboarding@resend.dev` as sender. Later you can add your own domain.

## 📝 Step 3: Update Your Edge Function

1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/functions/send-batch-email
2. **Replace the entire function code** with the content from:
   `/home/happy/projects/hpms/supabase/functions/send-batch-email/resend-version.ts`
3. Click **Deploy**

## 🧪 Step 4: Test It!

1. Go to your Batch Management tab
2. Try submitting a batch
3. You should see: `"Batch sent successfully to recipient@email.com"`

## 📊 Resend Benefits

### Free Tier:
- ✅ **3,000 emails/month** forever
- ✅ **100 emails/day** limit
- ✅ Perfect for medical practices

### Features:
- ✅ **Professional delivery** (99%+ delivery rate)
- ✅ **Real-time analytics** (opens, clicks, bounces)
- ✅ **Beautiful email templates**
- ✅ **Developer-friendly API**
- ✅ **Excellent documentation**

### Pricing:
- **Free**: 3,000 emails/month
- **Pro**: $20/month for 50,000 emails
- **Business**: $50/month for 100,000 emails

## 🏷️ Step 5: Add Your Own Domain (Optional)

Later, you can add your own domain:

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `yourpractice.com`)
3. Configure DNS records
4. Update `SENDER_EMAIL` to `noreply@yourpractice.com`

## 🔍 Monitoring

Resend provides excellent analytics:
- **Delivery status** for each email
- **Open rates** by recipient
- **Bounce handling** for invalid emails
- **Click tracking** for links

Perfect for monitoring your medical claims delivery!

## 🚀 Expected Results

After setup, you should see:
- ✅ No more "missing environment variables" errors
- ✅ Professional email delivery to medical aid providers
- ✅ Batch status changes to 'sent'
- ✅ Beautiful HTML emails with proper branding
- ✅ Attachments delivered correctly

Your batch submission system will be production-ready! 🎉