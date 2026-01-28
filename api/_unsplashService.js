const { createApi } = require('unsplash-js');
const fetch = require('node-fetch');
const cache = require('./_cache');

// Initialize Unsplash API client
// API key should be provided via environment variable
const unsplash = process.env.UNSPLASH_ACCESS_KEY
  ? createApi({
      accessKey: process.env.UNSPLASH_ACCESS_KEY,
      fetch: fetch
    })
  : null;

/**
 * Fetch a photo URL from Unsplash based on search query
 * @param {string} query - Search query (e.g., "berlin brandenburg gate")
 * @param {string} orientation - Photo orientation: "landscape", "portrait", "squarish"
 * @returns {Promise<string|null>} Photo URL or null if not found/error
 */
async function getPhotoByQuery(query, orientation = 'landscape') {
  if (!unsplash) {
    console.warn('Unsplash API not configured. Set UNSPLASH_ACCESS_KEY environment variable.');
    return null;
  }

  // Check cache first
  const cacheKey = `unsplash:${query}:${orientation}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await unsplash.search.getPhotos({
      query,
      page: 1,
      perPage: 1,
      orientation
    });

    if (result.errors) {
      console.error('Unsplash API errors:', result.errors);
      return null;
    }

    if (result.response && result.response.results.length > 0) {
      const photo = result.response.results[0];
      const photoUrl = photo.urls.regular; // 1080px width

      // Cache for 7 days
      cache.set(cacheKey, photoUrl, cache.TTL.IMAGES);

      return photoUrl;
    }

    return null;
  } catch (error) {
    console.error('Error fetching from Unsplash:', error.message);
    return null;
  }
}

/**
 * Fetch a random photo from Unsplash based on query
 * @param {string} query - Search query
 * @returns {Promise<string|null>} Photo URL or null
 */
async function getRandomPhoto(query) {
  if (!unsplash) {
    return null;
  }

  const cacheKey = `unsplash:random:${query}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await unsplash.photos.getRandom({
      query,
      orientation: 'landscape',
      count: 1
    });

    if (result.errors) {
      console.error('Unsplash API errors:', result.errors);
      return null;
    }

    if (result.response) {
      const photo = Array.isArray(result.response) ? result.response[0] : result.response;
      const photoUrl = photo.urls.regular;

      // Cache for 7 days
      cache.set(cacheKey, photoUrl, cache.TTL.IMAGES);

      return photoUrl;
    }

    return null;
  } catch (error) {
    console.error('Error fetching random photo from Unsplash:', error.message);
    return null;
  }
}

/**
 * Enrich location data with Unsplash image URL
 * Falls back to provided imageUrl if Unsplash fails or is not configured
 * @param {object} location - Location object with unsplashQuery and imageUrl
 * @returns {Promise<object>} Location object with potentially updated imageUrl
 */
async function enrichLocationWithImage(location) {
  if (!location.unsplashQuery) {
    return location;
  }

  // Try to get image from Unsplash
  const unsplashUrl = await getPhotoByQuery(location.unsplashQuery);

  // If successful, use Unsplash URL; otherwise keep fallback
  if (unsplashUrl) {
    return {
      ...location,
      imageUrl: unsplashUrl,
      imageSource: 'unsplash'
    };
  }

  return location;
}

/**
 * Enrich multiple locations with Unsplash images
 * Implements rate limiting to respect API limits (50 requests/hour on free tier)
 * @param {Array} locations - Array of location objects
 * @param {number} maxRequests - Maximum number of API requests to make (default: 10)
 * @returns {Promise<Array>} Array of enriched locations
 */
async function enrichLocationsWithImages(locations, maxRequests = 10) {
  if (!unsplash || !locations || locations.length === 0) {
    return locations;
  }

  const enriched = [];
  let requestCount = 0;

  for (const location of locations) {
    // Check if we've hit the request limit
    if (requestCount >= maxRequests) {
      // Return remaining locations unchanged
      enriched.push(location);
      continue;
    }

    // Check cache first (doesn't count against request limit)
    const cacheKey = `unsplash:${location.unsplashQuery}:landscape`;
    const cached = cache.get(cacheKey);

    if (cached) {
      // Use cached image
      enriched.push({
        ...location,
        imageUrl: cached,
        imageSource: 'unsplash'
      });
    } else if (location.unsplashQuery) {
      // Fetch from API
      const enrichedLocation = await enrichLocationWithImage(location);
      enriched.push(enrichedLocation);

      // Only count as request if we actually called the API
      if (enrichedLocation.imageSource === 'unsplash') {
        requestCount++;
      }

      // Small delay to avoid rate limiting (200ms between requests)
      if (requestCount < maxRequests) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } else {
      // No unsplashQuery, return as-is
      enriched.push(location);
    }
  }

  return enriched;
}

/**
 * Check if Unsplash API is configured and available
 * @returns {boolean} True if API is configured
 */
function isConfigured() {
  return unsplash !== null;
}

/**
 * Get API usage statistics (if available)
 * @returns {object} Usage stats
 */
function getUsageStats() {
  return {
    configured: isConfigured(),
    rateLimitPerHour: 50, // Free tier limit
    recommendation: 'Cache images for 7 days to minimize API calls'
  };
}

module.exports = {
  getPhotoByQuery,
  getRandomPhoto,
  enrichLocationWithImage,
  enrichLocationsWithImages,
  isConfigured,
  getUsageStats
};
