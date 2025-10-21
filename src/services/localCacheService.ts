/**
 * Local Cache Service
 *
 * Provides aggressive local caching to bypass slow network requests
 * Stores data in localStorage with timestamps
 */

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'hpms_cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

class LocalCacheService {
  private getKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * Set data in cache with TTL (time to live)
   */
  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION
      };

      const cacheKey = this.getKey(key);
      localStorage.setItem(cacheKey, JSON.stringify(entry));

      // Also store TTL separately for easy checking
      localStorage.setItem(`${cacheKey}_ttl`, String(ttlMinutes * 60 * 1000));

      console.log(`💾 Cached ${key} (TTL: ${ttlMinutes} minutes)`);
    } catch (error) {
      console.error('Cache write error:', error);
      // If localStorage is full, clear old cache entries
      this.clearOldEntries();
    }
  }

  /**
   * Get data from cache if valid
   */
  get<T>(key: string): T | null {
    try {
      const cacheKey = this.getKey(key);
      const entry = localStorage.getItem(cacheKey);
      const ttl = localStorage.getItem(`${cacheKey}_ttl`);

      if (!entry || !ttl) return null;

      const parsed: CacheEntry<T> = JSON.parse(entry);

      // Check version
      if (parsed.version !== CACHE_VERSION) {
        this.remove(key);
        return null;
      }

      // Check TTL
      const age = Date.now() - parsed.timestamp;
      const maxAge = parseInt(ttl);

      if (age > maxAge) {
        console.log(`🕐 Cache expired for ${key} (age: ${Math.round(age/1000)}s)`);
        this.remove(key);
        return null;
      }

      console.log(`✅ Cache hit for ${key} (age: ${Math.round(age/1000)}s)`);
      return parsed.data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Check if cache exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    const cacheKey = this.getKey(key);
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_ttl`);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('🗑️ All cache cleared');
  }

  /**
   * Clear old/expired entries to free up space
   */
  clearOldEntries(): void {
    const keys = Object.keys(localStorage);
    let cleared = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX) && !key.endsWith('_ttl')) {
        try {
          const entry = localStorage.getItem(key);
          if (entry) {
            const parsed: CacheEntry<any> = JSON.parse(entry);
            const ttl = localStorage.getItem(`${key}_ttl`);

            if (!ttl || Date.now() - parsed.timestamp > parseInt(ttl)) {
              localStorage.removeItem(key);
              localStorage.removeItem(`${key}_ttl`);
              cleared++;
            }
          }
        } catch (error) {
          // Remove corrupted entries
          localStorage.removeItem(key);
          cleared++;
        }
      }
    });

    if (cleared > 0) {
      console.log(`🗑️ Cleared ${cleared} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    totalSize: number;
    entries: Array<{ key: string; size: number; age: number }>;
  } {
    const keys = Object.keys(localStorage);
    const entries: Array<{ key: string; size: number; age: number }> = [];
    let totalSize = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX) && !key.endsWith('_ttl')) {
        const value = localStorage.getItem(key);
        if (value) {
          const size = value.length * 2; // Approximate bytes (UTF-16)
          totalSize += size;

          try {
            const parsed: CacheEntry<any> = JSON.parse(value);
            const age = Math.round((Date.now() - parsed.timestamp) / 1000);
            entries.push({
              key: key.replace(CACHE_PREFIX, ''),
              size,
              age
            });
          } catch (error) {
            // Skip invalid entries
          }
        }
      }
    });

    return {
      totalEntries: entries.length,
      totalSize,
      entries: entries.sort((a, b) => b.size - a.size)
    };
  }
}

// Export singleton instance
export const localCache = new LocalCacheService();

// Export for window debugging
if (typeof window !== 'undefined') {
  (window as any).localCache = localCache;
}