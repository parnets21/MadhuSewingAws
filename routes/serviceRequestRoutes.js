const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/authMiddleware");     
const { assignTechnician } = require('../controllers/technicianController');
const { 
  createServiceRequest, 
  getServiceRequests, 
  getUserServiceRequests 
} = require("../controllers/serviceRequestController");

// Multer Storage for Files
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "image") {
            if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
                return cb(new Error('Only image files are allowed!'), false);
            }
        } else if (file.fieldname === "video") {
            if (!file.originalname.match(/\.(mp4|mov|avi|wmv)$/)) {
                return cb(new Error('Only video files are allowed!'), false);
            }
        }
        cb(null, true);
    }
});       
router.put('/:id/assign', assignTechnician);

// Protected Routes (Requires Authentication)
router.post("/", protect, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
]), createServiceRequest);
router.get("/my-requests", protect, getUserServiceRequests); 


router.get("/", getServiceRequests);

module.exports = router;