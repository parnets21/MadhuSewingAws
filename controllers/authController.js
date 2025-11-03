const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register a new user
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user with address
    const user = new User({ 
      name, 
      email, 
      phone, 
      password, 
      address,
      role: "user" 
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ 
      message: "Registration successful", 
      token,
      userId: user._id,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      message: "Registration failed",
      error: error.message 
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({ 
      message: "Login successful", 
      token,
      userId: user._id,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      message: "Login failed",
      error: error.message 
    });
  }
};

// Get user profile
// exports.getProfile = async (req, res) => {
//   try {
//     const { userId } = req.body;
//     if (!userId) {
//       return res.status(401).json({ message: "Unauthorized access" });
//     }
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error fetching profile:", error);
//     res.status(500).json({ 
//       message: "Failed to fetch profile",
//       error: error.message 
//     });
//   }
// }; 
 
// In your authController.js
exports.getProfile = async (req, res) => {
  try {
    // Accept both query params and body
    const userId = req.query.userId || req.body.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized access" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ 
      message: "Failed to fetch profile",
      error: error.message 
    });
  }
};
