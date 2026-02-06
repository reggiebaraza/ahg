const cache = require('./_cache');
const { INSPIRATIONS } = require('./_data');
const { enrichLocationsWithImages } = require('./_unsplashService');

module.exports = async (req, res) => {
    try {
        // Check cache first (24 hour TTL for all inspirations)
        const cacheKey = 'all-inspirations:full';
        const cached = cache.get(cacheKey);

        if (cached) {
            return res.status(200).json(cached);
        }

        // Return all 80 curated locations
        // Optionally enrich with Unsplash images (limited to avoid rate limits)
        // Since this is called less frequently, we can enrich more locations
        const enrichedLocations = await enrichLocationsWithImages(
            INSPIRATIONS,
            10 // Limit to 10 API calls per request
        );

        // Cache for 24 hours
        cache.set(cacheKey, enrichedLocations, cache.TTL.LOCATIONS);

        res.status(200).json(enrichedLocations);
    } catch (error) {
        console.error("Error fetching all inspirations:", error);

        // Fallback to returning the dataset as-is
        res.status(200).json(INSPIRATIONS);
    }
};
