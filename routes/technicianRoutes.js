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
  assignTechnician,
  updateTechnicianLocation,
  getTechnicianLocation,
  getTechnicianLocationHistory
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

// Location tracking routes
router.post('/location/update', updateTechnicianLocation);
router.get('/:id/location', getTechnicianLocation);
router.get('/:id/location/history', getTechnicianLocationHistory);

module.exports = router;
