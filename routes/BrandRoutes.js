const express = require("express");
const multer = require("multer");
const router = express.Router();
const brandController = require("../controllers/BrandController");

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save uploaded images to `uploads` folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});

const upload = multer({ storage });

// 🛒 Create a new brand (Admin Only)
router.post("/", upload.single("logo"), brandController.createBrand);

// 🛒 Get all brands
router.get("/", brandController.getAllBrands);

// 🛒 Get a single brand by ID
router.get("/:id", brandController.getBrandById);

// 🛒 Update a brand (Admin Only) - Only Name & Logo
router.put("/:id", upload.single("logo"), brandController.updateBrand);

// 🛒 Delete a brand (Admin Only)
router.delete("/:id", brandController.deleteBrand);

module.exports = router;
