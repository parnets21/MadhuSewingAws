const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/protect');
// const userController = require('../controllers/userController');
// Register route
router.post('/register', authController.register);

// Login route
router.post('/login', authController.login);

// Protected profile route
// router.get('/profile', authController.getProfile); 
// Change from GET to POST
router.post('/profile', authController.getProfile);

// Forgot password flow
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);



module.exports = router;
