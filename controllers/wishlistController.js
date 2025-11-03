const Wishlist = require("../models/Wishlist");

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id; // Extracted from authMiddleware

    let wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
      wishlist = new Wishlist({ userId, productIds: [] });
    }

    // Check if product already exists in wishlist
    if (!wishlist.productIds.includes(productId)) {
      wishlist.productIds.push(productId);
      await wishlist.save();
    }

    res.status(200).json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

// Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: "Wishlist not found" });
    }

    wishlist.productIds = wishlist.productIds.filter(id => id.toString() !== productId);
    await wishlist.save();

    res.status(200).json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

// Get user wishlist
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const wishlist = await Wishlist.findOne({ userId }).populate("productIds");
    
    if (!wishlist) {
      return res.status(200).json({ success: true, wishlist: [] });
    }

    res.status(200).json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error });
  }
};
