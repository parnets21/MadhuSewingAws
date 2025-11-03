const express = require("express");
const { addToWishlist, removeFromWishlist, getWishlist } = require("../controllers/wishlistController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Add a product to wishlist
router.post("/add", protect, addToWishlist);

// Remove a product from wishlist
router.post("/remove", protect, removeFromWishlist);

// Get the user's wishlist
router.get("/", protect, getWishlist);

module.exports = router;
