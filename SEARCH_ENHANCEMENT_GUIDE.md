# Enhanced Patient Search & Management Features

## 1. Full Screen Modal Support
- The patient modal now supports full-screen mode via the maximize/minimize button
- When in full-screen mode, the modal takes up the entire viewport for better visibility
- The border radius is removed in full-screen mode for a seamless experience

## 2. State-of-the-Art Search Functionality

### Basic Search
- Search by patient name, email, phone number, ID number
- Real-time search as you type with debouncing
- Case-insensitive matching

### Advanced Fuzzy Search
- Fuzzy matching algorithm that finds partial matches
- Typo tolerance - finds "Jon" when searching for "John"
- Multi-field search across multiple patient attributes

### Natural Language Search
The search supports natural language queries like:
- "female patients" - finds all female patients
- "male over 40" - finds male patients over 40 years old
- "insured patients" - finds patients with medical aid
- "women under 30" - finds female patients under 30

### AI-Powered Search
- Click the AI (bot) icon to use GPT-powered search
- Understands complex queries like:
  - "patients with diabetes over 50"
  - "everyone who visited last month"
  - "patients with high blood pressure"

## 3. Bulk Actions on Filtered Lists

### SMS to Filtered Patients
- Select patients using checkboxes
- Click SMS button to send bulk SMS
- Only sends to patients with valid phone numbers
- Shows success/failure counts

### Email to Filtered Patients
- Select patients using checkboxes
- Click Email button to send bulk emails
- Professional email template with practice branding
- Only sends to patients with valid email addresses

### Export Filtered Patients
- Export current filtered list to CSV or JSON
- CSV includes all patient details in spreadsheet format
- JSON provides structured data for integration
- Filename includes date for easy tracking

## 4. Email All Patients Feature
- Available from both Patients page and Patient Modal
- Automatically filters patients with valid email addresses
- Uses professional HTML email template
- Includes practice branding and contact information

## Usage Examples

### Example 1: Send appointment reminders to female patients over 50
1. Search: "female over 50"
2. Select all patients in results
3. Click SMS or Email button
4. Customize message and send

### Example 2: Export insured patients for billing
1. Search: "insured" or click "Insured" filter
2. Click Export button
3. Choose CSV format
4. Open in Excel for billing processing

### Example 3: AI Search for specific conditions
1. Type: "patients who complained of headaches in the last 3 months"
2. Click the AI search button
3. Review filtered results
4. Take bulk actions as needed

## Technical Implementation

### Search Utils (`/src/utils/searchUtils.ts`)
- `fuzzyMatch()` - Simple fuzzy matching algorithm
- `levenshteinDistance()` - Advanced string similarity
- `comprehensiveSearch()` - Main search function
- `parseNaturalQuery()` - Natural language parser

### Enhanced Patient Store
- Uses `comprehensiveSearch()` for all searches
- Supports fuzzy matching with configurable threshold
- Searches across multiple fields

### Bulk Communication
- SMS via `defaultSMSService`
- Email via Supabase Edge Functions
- Progress indicators during sending
- Error handling with retry logic

## Performance Optimizations
- Debounced search input (300ms delay)
- Efficient filtering algorithms
- Pagination for large result sets
- Lazy loading of patient details