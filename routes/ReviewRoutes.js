const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  getAllTestimonials,
  addTestimonial,
  updateTestimonial,
  deleteTestimonial,
} = require("../controllers/ReviewController");

// Multer setup for file upload (for images)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Routes
router.get("/", getAllTestimonials);
router.post("/", upload.single("image"), addTestimonial);
router.put("/:id", upload.single("image"), updateTestimonial);
router.delete("/:id", deleteTestimonial);

module.exports = router;
