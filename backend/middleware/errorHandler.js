const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.code === 'ENOENT') {
    statusCode = 404;
    message = 'Resource not found';
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
