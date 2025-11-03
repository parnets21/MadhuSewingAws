const jwt = require('jsonwebtoken');
const User = require('../models/User');
const createError = require('http-errors');

// 🔐 Middleware to protect routes (requires authentication)
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(createError(401, 'Not authorized, no token provided'));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified. Decoded:', decoded);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Token expired, please login again'));
      }
      return next(createError(401, 'Not authorized, invalid token'));
    }

    // Fetch user using decoded.userId
    const user = await User.findById(decoded.userId)
      .select('-password -__v -createdAt -updatedAt')
      .lean();

    if (!user) {
      console.error(`❌ User not found for ID: ${decoded.userId}`);
      return next(createError(401, 'User not found'));
    }

    // Check if password was changed after the token was issued
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        return next(createError(401, 'Password recently changed. Please log in again.'));
      }
    }

    req.user = user;
    res.locals.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    next(createError(500, 'Internal Server Error'));
  }
};

// 👮 Role-based access control middleware
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(createError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
};

// 🔓 Optional authentication (e.g., public pages with user info if logged in)
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔍 Optional Auth - Decoded:', decoded);

      const user = await User.findById(decoded.userId)
        .select('-password -__v -createdAt -updatedAt')
        .lean();

      if (user) {
        req.user = user;
        res.locals.user = user;
      }
    }

    next();
  } catch (error) {
    console.warn('⚠️ Optional authentication failed:', error.message);
    next();
  }
};
