// utils/logger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  base: { service: 'floors-backend' },
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'cookies.*',
    'password',
  ],
});

module.exports = logger;
