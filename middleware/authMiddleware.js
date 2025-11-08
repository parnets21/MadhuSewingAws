const jwt = require('jsonwebtoken');
const User = require('../models/User');
const createError = require('http-errors');

// 🔐 Middleware to protect routes (requires authentication)
exports.protect = async (req, res, next) => {
  try {
    // Check for static admin authentication (for static admin login)
    // Method 1: Check custom headers (Express normalizes to lowercase)
    const staticAdminEmail = req.headers['x-static-admin-email'];
    const staticAdminAuth = req.headers['x-static-admin-auth'];
    
    // Method 2: Check query parameters as fallback
    const staticAdminEmailQuery = req.query['staticAdminEmail'];
    const staticAdminAuthQuery = req.query['staticAdminAuth'];
    
    // Method 3: Check Authorization header with special format "StaticAdmin <email>"
    const authHeader = req.headers.authorization;
    const isStaticAdminAuth = authHeader && authHeader.startsWith('StaticAdmin ');
    
    // Debug logging
    console.log('🔍 Auth check:', {
      method: req.method,
      path: req.path,
      headerEmail: staticAdminEmail,
      headerAuth: staticAdminAuth,
      queryEmail: staticAdminEmailQuery,
      queryAuth: staticAdminAuthQuery,
      authHeader: authHeader ? authHeader.substring(0, 20) + '...' : 'missing',
      allHeaders: Object.keys(req.headers).filter(h => h.toLowerCase().includes('static') || h.toLowerCase() === 'authorization')
    });
    
    // Check static admin via headers
    if (staticAdminEmail === 'admin@madhu.com' && staticAdminAuth === 'true') {
      console.log('✅ Static admin authenticated via headers');
      req.user = {
        _id: 'static-admin',
        email: 'admin@madhu.com',
        role: 'admin',
        isAdmin: true,
        name: 'Admin'
      };
      res.locals.user = req.user;
      return next();
    }
    
    // Check static admin via query parameters
    if (staticAdminEmailQuery === 'admin@madhu.com' && staticAdminAuthQuery === 'true') {
      console.log('✅ Static admin authenticated via query params');
      req.user = {
        _id: 'static-admin',
        email: 'admin@madhu.com',
        role: 'admin',
        isAdmin: true,
        name: 'Admin'
      };
      res.locals.user = req.user;
      return next();
    }
    
    // Check static admin via Authorization header
    if (isStaticAdminAuth) {
      const email = authHeader.split(' ')[1];
      if (email === 'admin@madhu.com') {
        console.log('✅ Static admin authenticated via Authorization header');
        req.user = {
          _id: 'static-admin',
          email: 'admin@madhu.com',
          role: 'admin',
          isAdmin: true,
          name: 'Admin'
        };
        res.locals.user = req.user;
        return next();
      }
    }

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
