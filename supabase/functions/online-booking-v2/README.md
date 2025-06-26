# Online Booking V2 Edge Function

This edge function handles online booking requests from the practice website and creates visits in the new visits table structure.

## Key Features

- Creates visits with the new `scheduled_date` and `scheduled_time` fields
- Sets `is_scheduled=true` for booking requests from the website  
- Sets `is_confirmed=false` initially (requires practice confirmation)
- Creates patient records if they don't exist
- Adds notification entries for new booking requests

## Deployment

1. Deploy the function:
```bash
supabase functions deploy online-booking-v2
```

2. Update the website booking form to use the new endpoint:
```
https://[project-ref].supabase.co/functions/v1/online-booking-v2
```

## Visit States

When a booking is created through this function:
- `is_scheduled`: true (indicates it's a scheduled booking from website)
- `is_confirmed`: false (needs confirmation from practice)
- `status`: 'scheduled'
- `scheduled_date`: The requested date
- `scheduled_time`: The requested time

## Usage in Visit Grid View

The Visit Grid View component now supports a `booking-requests` filter that shows:
- All visits where `is_scheduled=true` and `is_confirmed=false`
- Displays "Online Booking Requests" as the header
- Shows a "Website Bookings" badge

To view booking requests in the UI:
```typescript
<VisitGridView 
  filterStatus="booking-requests" 
  practiceId={practiceId}
  onClose={handleClose}
/>
```