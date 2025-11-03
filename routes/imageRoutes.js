const express = require('express');
const router = express.Router();
const multer = require('multer');
const imageController = require('../controllers/imageController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload images
router.post('/', upload.array('images', 10), imageController.uploadImages);

// Get uploaded images
router.get('/', imageController.getUploadedImages);

// Delete image
router.delete('/:filename', imageController.deleteImage);

module.exports = router;