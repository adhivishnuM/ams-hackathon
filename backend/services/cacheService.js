const NodeCache = require('node-cache');

// stdTTL: standard time to live in seconds (default 1 hour)
// checkperiod: period in seconds for automatic delete check interval
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

/**
 * Cache Service Wrapper
 */
const cacheService = {
    /**
     * Get a value from cache
     * @param {string} key 
     */
    get: (key) => {
        return cache.get(key);
    },

    /**
     * Set a value in cache
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttl - Time to live in seconds
     */
    set: (key, value, ttl = 3600) => {
        return cache.set(key, value, ttl);
    },

    /**
     * Delete a value from cache
     * @param {string} key 
     */
    del: (key) => {
        return cache.del(key);
    },

    /**
     * Flush all data
     */
    flush: () => {
        return cache.flushAll();
    },

    /**
     * Generate a cache key from arguments
     * @param {string} prefix 
     * @param {any} args 
     */
    generateKey: (prefix, ...args) => {
        const hash = JSON.stringify(args);
        return `${prefix}:${hash}`;
    }
};

module.exports = cacheService;
