const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.code === 'ENOENT') {
    statusCode = 404;
    message = 'Resource not found';
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'Uploaded video is larger than the configured limit';
  }

  // Database connection errors
  if (err.message && err.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Database service unavailable';
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
