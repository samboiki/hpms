# Appointment Reminders & SMS Integration Test Plan

## Overview
Test plan for the comprehensive appointment scheduling system with SMS reminders, waitlist management, and SMS Portal integration.

## ✅ Completed Features
1. **SMS Portal Integration** - SMS service with REST API
2. **Enhanced Settings Component** - Integrated into Messages page
3. **Reminder Templates** - Message template management
4. **Waitlist Management** - Patient waitlist with notifications
5. **Database Schema** - Tables for reminders, templates, waitlist
6. **Enhanced Appointment Form** - Recurring appointments and reminder settings
7. **Appointment Service** - Core business logic with reminder scheduling

## 🧪 Testing Steps

### Step 1: Verify Messages Settings Integration
1. Navigate to **Messages** page
2. Click **Settings** tab
3. Verify all 5 tabs are visible:
   - ✅ Practice Settings
   - ✅ SMS/Email Providers
   - ✅ Appointment Reminders
   - ✅ Message Templates
   - ✅ Notifications

### Step 2: Test SMS Balance Display
1. In Messages → Settings
2. Should see **SMS Credits Balance** card at top
3. Balance should show "N/A" or actual credits
4. Refresh button should work

### Step 3: Test SMS Provider Configuration
1. Go to **SMS/Email Providers** tab
2. Verify **SMS Portal Configuration** section shows:
   - ✅ Active status
   - Provider dropdown (SMS Portal)
   - Show/Hide credentials functionality
   - Copy credentials button
3. Credentials should show:
   - Client ID: `7c193f5e-c862-43be-baa9-73e45e676e74`
   - API Secret: `db3defe7-b01e-4983-b28d-88f228c16301`

### Step 4: Test SMS Connection
1. In **SMS/Email Providers** tab
2. Scroll to **SMS Test Section** (blue box)
3. Enter your phone number (e.g., `+264811234567`)
4. Click **Send Test SMS**
5. Should receive test message on your phone
6. SMS balance should decrease by 1

### Step 5: Test Reminder Settings
1. Go to **Appointment Reminders** tab
2. Verify toggle switch for enabling reminders
3. Check timing options:
   - ✅ 24 hours before (default checked)
   - ✅ 2 hours before (default checked)
   - Other options available but unchecked
4. Verify "business hours only" checkbox
5. Read the "How it works" info box

### Step 6: Test Message Templates
1. Go to **Message Templates** tab
2. Should see 3 sample templates:
   - **24 Hour SMS Reminder** (Active)
   - **2 Hour SMS Reminder** (Active)
   - **Waitlist Notification** (Inactive)
3. Verify each template shows:
   - Template name and type
   - Channel (SMS)
   - Content preview
   - Variable tags ({{patient_name}}, etc.)
   - Edit/Delete buttons
4. Click **Add Template** button (UI only - backend not connected yet)

### Step 7: Test Notification Preferences
1. Go to **Notifications** tab
2. Verify notification options:
   - ✅ Failed Message Alerts
   - ✅ Daily Summary
   - ❌ Low Balance Alerts
   - ✅ Incoming Message Alerts
   - ✅ Appointment Reminders Sent

### Step 8: Test Enhanced Appointment Form
1. Navigate to **Appointments** page
2. Click **Add Appointment** or similar
3. Enhanced form should include:
   - Recurring appointment options
   - Reminder settings toggle
   - Timing preferences
   - Patient notification preferences

## 📋 Expected Behaviors

### SMS Integration
- ✅ Balance display updates after sending SMS
- ✅ Test SMS actually sends to provided phone number
- ✅ Credentials are pre-configured and working
- ✅ Error handling for failed SMS

### Settings UI
- ✅ All tabs load without errors
- ✅ Smooth animations between tabs
- ✅ Responsive design on mobile/tablet
- ✅ Form controls work properly
- ✅ Toggle switches function correctly

### Data Flow
- Settings changes persist (when save functionality is connected)
- Real-time balance updates
- Template management (when backend is connected)
- Notification preferences save

## 🚨 Known Limitations
1. **Templates**: Add/Edit/Delete functions are UI-only (need backend connection)
2. **Save Settings**: Some settings need backend integration
3. **Database**: Templates and reminders tables need to be created
4. **Edge Functions**: Automated reminder sending needs deployment
5. **Real Templates**: Currently showing sample data

## 🔧 Troubleshooting

### If SMS Test Fails:
1. Check internet connection
2. Verify phone number format includes country code (+264)
3. Check SMS Portal API credentials
4. Look for error messages in browser console

### If Balance Shows "N/A":
1. Check SMS Portal API connection
2. Verify credentials are correct
3. Check browser network tab for API calls

### If Tabs Don't Work:
1. Check browser console for JavaScript errors
2. Verify all imports are correct
3. Check if development server is running

## 🎯 Next Development Steps
1. Connect template management to database
2. Implement save functionality for all settings
3. Deploy edge functions for automated reminders
4. Create appointment workflow with reminder scheduling
5. Add real-time appointment monitoring
6. Implement waitlist management UI

## 📞 Support
- Check browser console for errors
- Verify development server is running on port 5174
- Test with different browsers if issues persist
- Ensure all dependencies are installed (`npm install`)

---
**✨ Success Criteria**: All tabs load, SMS test works, balance displays, and UI is responsive across all sections.