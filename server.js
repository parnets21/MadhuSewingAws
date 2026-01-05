require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');  
const path = require('path');

const app = express();

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Basic Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow all origins for now, or specify your frontend URL
    callback(null, true);
  },
  credentials: true,
  exposedHeaders: ['x-static-admin-email', 'x-static-admin-auth'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-static-admin-email', 'x-static-admin-auth', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  }
};

connectDB();   
 


// Routes
const routes = require('./routes/index');
app.use('/api', routes);

// Test endpoint to verify API is working
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working correctly',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Serve static files (uploads, public, etc.)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve build files (if they exist)
const buildPath = path.join(__dirname, 'build');
try {
  const fs = require('fs');
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
  }
} catch (err) {
  console.warn('Build folder not found, skipping static file serving');
}

// Redirect all other requests to the index.html file (SPA fallback)
// This MUST be after all API routes and static files
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, 'build', 'index.html');
  try {
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  } catch (err) {
    console.warn('index.html not found');
  }
  // If build doesn't exist, return 404
  res.status(404).json({
    success: false,
    message: 'Not found'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;