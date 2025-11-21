const { admin } = require("../config/firebase");
const logger = require('../utils/logger');
const verifyToken = async (req, res, next) => {
  const idToken = req.cookies.access_token;
  if (!idToken) {
    logger.warn({ path: req.originalUrl }, 'No token provided');
    return res.status(403).json({ error: 'No token provided' });
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    logger.debug({ uid: decodedToken.uid, path: req.originalUrl }, 'Token verified');
    next();
  } catch (error) {
    logger.error({ err: error, path: req.originalUrl }, 'Error verifying token');
    return res.status(403).json({ error: 'Unauthorized' });
  }
};

module.exports = verifyToken;