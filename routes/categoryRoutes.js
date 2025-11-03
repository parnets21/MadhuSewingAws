const express = require("express");
const router = express.Router();
const multer = require("multer");
const { getCategories, addCategory, deleteCategory } = require("../controllers/categoryController");

// Configure Multer for image uploads
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

router.post("/addcategory", upload.any(), addCategory);
router.get("/getcategory", getCategories); // Fetch categories

// ✅ Add DELETE route
router.delete("/deletecategory/:id", deleteCategory);

module.exports = router;
