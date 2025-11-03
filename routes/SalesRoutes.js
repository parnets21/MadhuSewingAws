const express = require("express");
const router = express.Router();
const { addSalesBanner, deleteSalesBanner, getSalesBanner } = require("../controllers/SalesController");
const multer = require("multer");
const path = require("path");

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Routes
router.post("/", upload.single("image"), addSalesBanner);
router.delete("/", deleteSalesBanner);
router.get("/", getSalesBanner);

module.exports = router;