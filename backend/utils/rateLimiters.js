const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const logger = require('../utils/logger');

const isProd = process.env.NODE_ENV === 'production';


const stdMsg = (m) => ({ error: m || 'Too many requests. Please try again later.' });

const makeHandler = (message) => (req, res, next, options) => {
  logger?.warn?.({ ip: req.ip, path: req.originalUrl }, 'Rate limit exceeded');
  res.status(options.statusCode).json(stdMsg(message));
};

// Auth: 10 requests / 10 minutes
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,         // <- safe IPv4/IPv6 handling
  handler: makeHandler('Too many auth attempts. Please wait a few minutes and try again.'),
});

// Reset password: 5 / 30 minutes
const resetPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: makeHandler('Too many password reset attempts. Try again later.'),
});

// Admin: 100 / 5 minutes
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: makeHandler('Admin rate limit exceeded. Please slow down.'),
});

// Global API: 1000 / hour (dev higher)
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 1000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: makeHandler('Too many requests. Please try again later.'),
});

module.exports = {
  authLimiter,
  resetPasswordLimiter,
  adminLimiter,
  apiLimiter,
};
