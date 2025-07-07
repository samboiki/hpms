# Google Reviews Integration Setup for NewCharm Dental

## Overview
To display real Google Reviews on your website, you need to set up the Google Places API. This guide will walk you through the process.

## Prerequisites
1. A Google Cloud Platform account
2. NewCharm Dental's Google Business Profile verified and active
3. Credit card for Google Cloud Platform (they offer $300 free credits)

## Step 1: Set up Google Cloud Platform

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for your project

## Step 2: Enable Google Places API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Places API"
3. Click on "Places API" and then "Enable"

## Step 3: Create API Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the API key
4. Click "Edit API Key" to add restrictions:
   - Application restrictions: HTTP referrers
   - Add your website URLs:
     - `http://localhost:3000/*`
     - `https://newcharmdental.com/*`
   - API restrictions: Restrict to "Places API"

## Step 4: Get Your Google Place ID

1. Go to [Google Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)
2. Search for "NewCharm Dental Windhoek"
3. Copy the Place ID (it looks like: `ChIJxxxxxxxxxxxxxxxxxxxxxx`)

## Step 5: Create Edge Function for Google Reviews

Create a new file: `/home/happy/projects/hpms/supabase/functions/fetch-google-reviews/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!
const PLACE_ID = Deno.env.get('NEWCHARM_PLACE_ID')!

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Fetch place details including reviews
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,user_ratings_total,reviews&key=${GOOGLE_API_KEY}`
    )

    const data = await response.json()

    if (data.status !== 'OK') {
      throw new Error(`Google API error: ${data.status}`)
    }

    // Transform the reviews data
    const reviews = data.result.reviews?.map((review: any) => ({
      author_name: review.author_name,
      author_url: review.author_url,
      profile_photo_url: review.profile_photo_url,
      rating: review.rating,
      relative_time_description: review.relative_time_description,
      text: review.text,
      time: review.time,
    })) || []

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name: data.result.name,
          rating: data.result.rating,
          total_ratings: data.result.user_ratings_total,
          reviews: reviews
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

## Step 6: Set Environment Variables

In your Supabase project:
```bash
supabase secrets set GOOGLE_API_KEY=your-api-key-here
supabase secrets set NEWCHARM_PLACE_ID=your-place-id-here
```

## Step 7: Update the Component

Update the `NewCharmTestimonials.tsx` component to fetch real reviews:

```typescript
useEffect(() => {
  const fetchGoogleReviews = async () => {
    try {
      const response = await supabase.functions.invoke('fetch-google-reviews')
      if (response.data?.success) {
        const { reviews, rating, total_ratings } = response.data.data
        // Update your state with real reviews
        setGoogleReviews(reviews)
        setOverallRating(rating)
        setTotalReviews(total_ratings)
      }
    } catch (error) {
      console.error('Error fetching Google reviews:', error)
    }
  }

  fetchGoogleReviews()
}, [])
```

## Important Notes

1. **API Limits**: Google Places API has usage limits. Monitor your usage in the Google Cloud Console.

2. **Caching**: Consider caching reviews in your database to avoid hitting API limits. Update them periodically (e.g., daily).

3. **Review Guidelines**: Display reviews according to Google's guidelines. Always show the Google logo and link back to Google.

4. **Privacy**: Some review authors may not have profile photos. Use a default avatar in these cases.

5. **Moderation**: You cannot filter or modify Google Reviews content. You must display them as-is.

## Alternative: Google Reviews Widget

If you prefer a simpler solution, you can use the official Google Reviews widget:

1. Go to your Google Business Profile
2. Click on "Get more reviews"
3. Select "Share review form"
4. Copy the embed code
5. Add it to your website

## Testing

1. Set up a test environment with your API credentials
2. Verify that reviews are loading correctly
3. Check that the Google attribution is displayed
4. Test error handling when API is unavailable