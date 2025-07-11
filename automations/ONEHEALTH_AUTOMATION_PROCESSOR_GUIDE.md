# OneHealth Automation Processor - Master Workflow

## Overview

This is the master n8n workflow that processes ALL automation types for OneHealth:
- Welcome emails
- Appointment reminders
- Follow-ups
- Birthday wishes
- Lab results notifications
- Payment reminders
- And 19 more automation types

## Workflow Name
`OneHealth Automation Processor` (not specific to any single automation type)

## Features

### 1. Universal Processing
- Single workflow handles all 25 automation types
- Dynamically adapts templates based on automation type
- Supports both SMS and Email channels

### 2. Gmail Integration
- Uses n8n's native Gmail OAuth
- Automatic token refresh
- Per-practice credentials
- Fallback to Resend if Gmail fails

### 3. Smart Credential Management
```javascript
// Workflow automatically:
1. Fetches practice's n8n credential ID from database
2. Uses appropriate Gmail credential for each practice
3. Falls back to default if not configured
```

### 4. Batch Processing
- Processes up to 50 automations per minute
- Handles multiple practices simultaneously
- Efficient queue management

## Expansion Ready

As we add more automation types, this workflow will:
- Automatically handle new automation types
- Support practice-specific templates
- Manage different timing requirements
- Scale to thousands of automations

## Future Enhancements

### Phase 1 (Current)
- ✅ Welcome emails via Gmail
- ✅ SMS via centralized gateway
- ✅ Multi-practice support

### Phase 2 (Next)
- Appointment reminders (24h, 1h)
- Follow-up messages
- Birthday greetings

### Phase 3 (Future)
- Lab results notifications
- Payment reminders
- Health campaigns
- Custom automations

## Configuration

Each practice needs:
1. Gmail OAuth credentials in Settings
2. n8n credential created and ID stored
3. Automation templates configured
4. Channels enabled (SMS/Email)

## Monitoring

The workflow provides:
- Real-time execution logs
- Success/failure tracking
- Performance metrics
- Error details for debugging

This single workflow replaces multiple edge functions and provides a unified automation engine for the entire OneHealth platform.