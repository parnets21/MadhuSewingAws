require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');  
const path = require('path');

const app = express();

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

app.use(express.static(path.join(__dirname, 'build'))); // Change 'build' to your frontend folder if needed

// Redirect all requests to the index.html file

app.get("*", (req, res) => {
  return  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
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