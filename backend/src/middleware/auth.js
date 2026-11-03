const jwt = require('jsonwebtoken');
const env = require('../config/env');
const HttpError = require('../utils/HttpError');

// Reads "Authorization: Bearer <token>", verifies it and attaches req.user.
// The user id ALWAYS comes from the verified token, never from the request body/query.
module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Authentication required.'));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: Number(payload.sub) };
    next();
  } catch (err) {
    next(new HttpError(401, 'Invalid or expired token. Please log in again.'));
  }
};
