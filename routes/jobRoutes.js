const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { validateCreateJob, validateUpdateStatus } = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Get jobs for a specific technician
router.get('/technician/:technicianId', jobController.getTechnicianJobs);

// Update job status
router.patch('/:jobId/status', validateUpdateStatus, jobController.updateJobStatus);   

// Admin routes
router.post('/', protect, restrictTo('admin'), validateCreateJob, jobController.createJob);

// Get all jobs (admin)
router.get('/', jobController.getAllJobs);

// Get specific job by ID
router.get('/:id',  jobController.getJobById);

// Update job
router.put('/:id', protect, jobController.updateJob);

// Delete job (admin only)
router.delete('/:id', protect, restrictTo('admin'), jobController.deleteJob);

module.exports = router;
