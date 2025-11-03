const express = require("express");
const multer = require("multer");
const {
    getBanner,
    postBanner,
    updateBanner,
    deleteBanner
} = require("../controllers/bannerController");

const router = express.Router();

// ✅ Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // Store images in 'uploads' folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });

// ✅ Banner Routes
router.get("/", getBanner); // Get latest banner
router.post("/postbanner", upload.single("image"), postBanner); // Add new banner
router.put("/update", upload.single("image"), updateBanner); // Update existing banner
router.delete("/delete/:id", deleteBanner); // Delete a banner by ID

module.exports = router;
