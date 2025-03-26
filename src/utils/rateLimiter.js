class RateLimiter {
    constructor(maxRequests = 10, timeWindow = 60000) { // 10 requests per minute by default
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    canMakeRequest() {
        const now = Date.now();
        // Remove old requests outside the time window
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        return false;
    }

    getTimeUntilNextRequest() {
        if (this.requests.length === 0) return 0;
        const oldestRequest = this.requests[0];
        const now = Date.now();
        return Math.max(0, this.timeWindow - (now - oldestRequest));
    }
}

module.exports = RateLimiter;