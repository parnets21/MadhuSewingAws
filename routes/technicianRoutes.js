const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
  registerTechnician,
  loginTechnician,
  getTechnicians,
  getTechnicianById,
  getCurrentTechnician,
  updateTechnician,
  assignTechnician
} = require('../controllers/technicianController');

// Public routes
router.post('/', registerTechnician);
router.post('/login', loginTechnician);
router.get('/', getTechnicians);
router.get('/:id', getTechnicianById);
router.put('/service-requests/:id/assign', assignTechnician);  

// Protected routes
router.get('/profile/me',  getCurrentTechnician);
router.put('/profile/update', updateTechnician);

module.exports = router;
