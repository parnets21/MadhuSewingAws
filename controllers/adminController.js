const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ServiceRequest = require('../models/ServiceRequest');
const jwt = require('jsonwebtoken');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user').populate('products.product');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find().populate('user').populate('product').populate('technician');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalServiceRequests = await ServiceRequest.countDocuments();

    const recentOrders = await Order.find().sort('-createdAt').limit(5).populate('user');
    const recentServiceRequests = await ServiceRequest.find().sort('-createdAt').limit(5).populate('user');

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalServiceRequests,
      recentOrders,
      recentServiceRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setupAdminUser = async (req, res) => {
  try {
    const adminEmail = 'admin@example.com';
    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      adminUser = new User({
        name: 'Admin User',
        email: adminEmail,
        password: 'adminpassword123',
        role: 'admin',
        phone: '1234567890'
      });
      await adminUser.save();
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    const token = jwt.sign(
      { userId: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'Admin user setup complete', 
      token,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

