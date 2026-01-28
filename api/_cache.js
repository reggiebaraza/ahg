/**
 * Simple in-memory cache for Vercel serverless functions
 * Cache persists across invocations within the same instance
 */

const cache = new Map();

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached value or null if not found/expired
 */
function get(key) {
  const item = cache.get(key);

  if (!item) {
    return null;
  }

  // Check if expired
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }

  return item.value;
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlMs - Time to live in milliseconds
 */
function set(key, value, ttlMs) {
  const expiry = Date.now() + ttlMs;
  cache.set(key, { value, expiry });
}

/**
 * Clear specific cache key
 * @param {string} key - Cache key to clear
 */
function clear(key) {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
function clearAll() {
  cache.clear();
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
function getStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

// Predefined TTL constants
const TTL = {
  WEATHER: 30 * 60 * 1000,      // 30 minutes
  LOCATIONS: 24 * 60 * 60 * 1000, // 24 hours
  IMAGES: 7 * 24 * 60 * 60 * 1000, // 7 days
  OSM: 7 * 24 * 60 * 60 * 1000    // 7 days
};

module.exports = {
  get,
  set,
  clear,
  clearAll,
  getStats,
  TTL
};
