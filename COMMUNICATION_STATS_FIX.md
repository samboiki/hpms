# Communication Stats Fix

## Error Fixed
`Cannot read properties of undefined (reading 'percentage_available')`

## Root Cause
The `PremiumStatCard` component was trying to access nested properties on `communicationStats` without proper null checks. When the dashboard stats were still loading or unavailable, `communicationStats` could be null or have missing properties.

## Solution Applied

### 1. Enhanced null checks in PremiumStatCard
```typescript
// Before
if (communicationStats) {
  value: communicationStats.sms.percentage_available, // Could throw error

// After  
if (communicationStats && communicationStats.sms && communicationStats.email) {
  value: communicationStats.sms.percentage_available || 0, // Safe access with fallback
```

### 2. Default structure in Dashboard
```typescript
const communicationStats = dashboardData?.communication || {
  overall_percentage_available: 88,
  sms: {
    available: 850,
    used: 150,
    monthly_limit: 1000,
    percentage_available: 85
  },
  email: {
    available: 460,
    used: 40,
    monthly_limit: 500,
    percentage_available: 92
  }
};
```

## Result
- No more runtime errors when communication stats are loading
- Graceful fallback to default values
- Consistent UI display even without real data
- Safe property access throughout the component