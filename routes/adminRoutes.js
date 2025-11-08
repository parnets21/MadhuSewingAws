const express = require('express');
const { 
    getAllUsers, 
    getAllOrders, 
    getAllServiceRequests, 
    getDashboardStats, 
    setupAdminUser,
    deleteUser,
    getAllTechnicians,
    deleteTechnician
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const admin = require('../middleware/admin');

const router = express.Router();

// Admin routes with authentication and admin middleware
router.get('/users', protect, admin, getAllUsers);
router.delete('/users/:userId', protect, admin, deleteUser);
router.get('/technicians', protect, admin, getAllTechnicians);
router.delete('/technicians/:technicianId', protect, admin, deleteTechnician);
router.get('/orders', protect, admin, getAllOrders);
router.get('/service-requests', protect, admin, getAllServiceRequests);
router.get('/dashboard', protect, admin, getDashboardStats);
router.post('/setup', setupAdminUser);

module.exports = router;
