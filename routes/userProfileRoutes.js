const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

// PUT /api/user/update
router.put('/update', protect, authController.updateProfile);

module.exports = router;


