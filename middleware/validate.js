const { body } = require('express-validator');
const { validateRequest } = require('./validateRequest');

// Validation rules for creating a job
exports.validateCreateJob = [
  body('technicianId')
    .notEmpty()
    .withMessage('Technician ID is required'),
  
  body('subService.name')
    .notEmpty()
    .withMessage('Sub-service name is required'),
  
  body('user.name')
    .notEmpty()
    .withMessage('User name is required'),
  
  body('user.email')
    .notEmpty()
    .isEmail()
    .withMessage('Valid user email is required'),
  
  body('user.phone')
    .notEmpty()
    .withMessage('User phone is required'),
  
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Amount cannot be negative'),
  
  body('scheduledDate')
    .notEmpty()
    .isISO8601()
    .withMessage('Valid scheduled date is required'),
  
  body('scheduledTime')
    .notEmpty()
    .withMessage('Scheduled time is required'),
  
  body('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required'),
  
  body('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required'),
  
  validateRequest
];

// Validation rules for updating job status
exports.validateUpdateStatus = [
  body('status')
    .notEmpty()
    .isIn(['upcoming', 'accepted', 'completed', 'rejected'])
    .withMessage('Invalid status value'),
  
  validateRequest
];