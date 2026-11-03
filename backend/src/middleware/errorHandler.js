const HttpError = require('../utils/HttpError');

function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler: converts any error into a safe JSON response.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, errors: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body contains invalid JSON.' });
  }
  if (err.code === '23505') return res.status(409).json({ message: 'That record already exists.' });
  if (err.code === '23503') return res.status(409).json({ message: 'This record is referenced by other data.' });

  // Unknown errors: log details on the server, return nothing sensitive to the client.
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong. Please try again later.' });
}

module.exports = { notFound, errorHandler };
