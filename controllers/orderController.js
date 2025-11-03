const Order = require('../models/Order');

// Create new order
exports.createOrder = async (req, res) => {
  try {
    // Destructure required fields
    const { 
      fullName, 
      phone, 
      street, 
      city, 
      state, 
      zip,  // Changed from pincode to match frontend
      country, // Added to match frontend
      cartItems, 
      subtotal, 
      total, 
      paymentMethod 
    } = req.body;

    // Validate required fields
    const requiredFields = ['fullName', 'phone', 'street', 'city', 'state', 'zip', 'cartItems', 'paymentMethod'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Create order
    const newOrder = new Order({
      userId: req.user._id,  // Changed from req.user.userId to match your auth middleware
      fullName,
      phone,
      street,
      city,
      state,
      zip,  // Changed from pincode
      country, // Added
      cartItems: cartItems.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        images: item.images || [] // Changed from image to images array
      })),
      subtotal,
      total,
      paymentMethod,
      status: 'Pending'
    });

    const savedOrder = await newOrder.save();
    
    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: savedOrder
    });
    
  } catch (error) {
    console.error("Order creation error:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get orders for a specific user
exports.getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Verify the requesting user matches the userId or is admin
    if (req.user.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .select('-__v')
      .exec();

    res.status(200).json({ 
      success: true,
      count: orders.length,
      data: orders 
    });

  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get all orders (admin only)
exports.getAllOrders = async (req, res) => {
  try {
    // Verify admin access
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .select('-__v')
      .exec();

    res.status(200).json({ 
      success: true,
      count: orders.length,
      data: orders 
    });

  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Verify admin access
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};