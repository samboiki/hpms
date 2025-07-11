# Social Platform Settings - Dynamic Form Implementation

## What Was Changed

### 1. Renamed n8n Workflow
- Changed from: "HPMS Welcome Patient - Multi-Tenant"
- Changed to: "HPMS Automation Processor - All Types"
- This reflects that the workflow handles ALL automation types, not just welcome emails

### 2. Created Platform-Specific Settings Configuration
- New file: `/src/config/socialPlatformSettings.ts`
- Defines platform-specific:
  - Basic fields (account name, username, etc.)
  - API fields (app_id, client_id, page_id, etc.)
  - Capabilities (what the platform can do)
  - Rate limits (posts per hour/day)
  - Content limits (text length, image sizes, etc.)
  - Features (stories, polls, analytics, etc.)

### 3. Updated Social Account Form
The form now dynamically changes based on the selected platform:

#### For Gmail:
- Shows only relevant fields (Account Name)
- Shows OAuth connection button
- Hides irrelevant sections:
  - Broadcasting capabilities (Gmail only sends emails)
  - Rate limiting (handled by automation system)
  - Content limits (not applicable)
  - Platform features (not applicable)
- Shows Gmail-specific info about automation uses

#### For Social Media Platforms:
- Shows all relevant API fields based on platform
- Pre-fills default values for:
  - Capabilities (what the platform supports)
  - Rate limits (platform-specific)
  - Content limits (max text, image sizes, etc.)
  - Features (stories, polls, etc.)

## How It Works

1. **Platform Selection**:
   ```typescript
   onChange={(e) => {
     const platform = e.target.value;
     const defaults = getPlatformDefaults(platform);
     setFormData({ 
       ...formData, 
       platform,
       ...defaults
     });
   }}
   ```

2. **Conditional Rendering**:
   - API fields only show if platform needs them
   - Sections hide/show based on platform type
   - Gmail gets special OAuth section
   - Info section changes based on platform

3. **Platform Defaults**:
   - Facebook: 63,206 char limit, 10 images max
   - Instagram: 2,200 char limit, stories support
   - Twitter: 280 char limit, polls support
   - LinkedIn: 3,000 char limit, analytics
   - YouTube: Video-focused, long duration
   - TikTok: Short videos, many hashtags
   - Gmail: Email automation only

## Benefits

1. **Cleaner UI**: Users only see relevant fields
2. **Fewer Errors**: Pre-filled defaults reduce mistakes
3. **Platform-Aware**: Form adapts to each platform's requirements
4. **Gmail Integration**: Properly integrated for automation use
5. **Future-Ready**: Easy to add new platforms

## Testing

1. Go to Settings → Social tab
2. Click "Add Account"
3. Select different platforms and observe:
   - Form fields change
   - Defaults are applied
   - Gmail shows OAuth section
   - Other platforms show full options

## Next Steps

1. Implement OAuth flows for other platforms
2. Add validation based on platform limits
3. Create broadcasting service that respects these settings
4. Add more platforms as needed

The system is now ready for platform-specific social account configuration!