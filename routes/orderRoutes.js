const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Order = require("../models/Order");

// Input validation middleware
const validateOrderInput = (req, res, next) => {
  const requiredFields = [
    "fullName", 
    "phone", 
    "street", 
    "city", 
    "state", 
    "zip", 
    "cartItems",
    "subtotal",
   
    "total",
    "paymentMethod"
  ];
  
  const missingFields = requiredFields.filter(field => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  if (!Array.isArray(req.body.cartItems) || req.body.cartItems.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Cart items must be a non-empty array",
    });
  }

  // Validate each cart item
  for (const item of req.body.cartItems) {
    if (!item.productId || !item.name || !item.quantity || !item.price) {
      return res.status(400).json({
        success: false,
        message: "Each cart item must have productId, name, quantity, and price",
      });
    }
  }

  // Validate numerical values
  if (isNaN(req.body.subtotal)  || isNaN(req.body.total)) {
    return res.status(400).json({
      success: false,
      message: "Subtotal, shipping, and total must be valid numbers",
    });
  }
  next();
};

// Create a New Order (Protected route)
router.post("/", protect, validateOrderInput, async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      userId: req.user._id,
      status: "Pending",
      paymentStatus: "Pending",
      createdAt: new Date()
    };

    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: savedOrder.toObject(),
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return res.status(400).json({
      success: false,
      error:error.message
    })
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while creating order",
      
    });
  }
});

// Get Orders for Current User (Protected)
router.get("/my-orders", protect, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching orders",
    });
  }
});

// Get All Orders (Admin only)
router.get("/all", async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name email") // Ensure this line is present
      .lean();

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching orders",
    });
  }
});


// Get Order by ID (Protected)
router.get("/:orderId", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user owns the order or is admin
    if (order.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to access this order",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while fetching order",
    });
  }
});

// Update Order Status (Protected - Admin only)
router.put("/:orderId/status", protect, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const { status } = req.body;
    const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while updating order status",
    });
  }
});

// Delete an Order (Protected - Admin only)
router.delete("/:orderId", protect, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const order = await Order.findByIdAndDelete(req.params.orderId).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while deleting order",
    });
  }
});

module.exports = router;