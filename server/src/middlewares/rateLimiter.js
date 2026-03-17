const buckets = new Map();

const defaultOptions = {
  windowMs: 60 * 1000,
  max: 10,
  blockDurationMs: 5 * 60 * 1000,
};

module.exports = (options = {}) => {
  const config = { ...defaultOptions, ...options };
  return (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime: now + config.windowMs, blockedUntil: null };
    }

    if (entry.blockedUntil && entry.blockedUntil > now) {
      return res.status(429).json({
        message: 'Too many requests. Please wait before trying again.',
      });
    }

    entry.count += 1;

    if (entry.count > config.max) {
      entry.blockedUntil = now + config.blockDurationMs;
      entry.count = 0;
      entry.resetTime = now + config.windowMs;
      buckets.set(key, entry);
      return res.status(429).json({
        message: 'Too many login attempts. Try again later.',
      });
    }

    buckets.set(key, entry);
    return next();
  };
};
