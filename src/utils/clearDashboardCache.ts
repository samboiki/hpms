/**
 * Clear Dashboard Cache Utility
 *
 * Use this to force-refresh the dashboard data
 * Run in browser console: clearDashboardCache()
 */

export function clearAllDashboardCache() {
  // Clear all dashboard-related cache keys
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('dashboard') || key.includes('cache_'))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  console.log(`🔄 Cleared ${keysToRemove.length} dashboard cache entries`);
  console.log('✅ Dashboard cache cleared! Reload the page to test the new RPC function.');

  return keysToRemove.length;
}

// Make it available globally in the browser console
if (typeof window !== 'undefined') {
  (window as any).clearDashboardCache = clearAllDashboardCache;
}

export default clearAllDashboardCache;