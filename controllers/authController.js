const User = require('../models/User');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

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

// Helper to send OTP via Gmail
async function sendOtpEmail(toEmail, otp) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `Madhu Sewing Machines <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your Password Reset OTP',
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
  };

  await transporter.sendMail(mailOptions);
}

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    user.resetOtpVerified = false;
    await user.save({ validateBeforeSave: false });

    await sendOtpEmail(email, otp);
    return res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email });
    if (!user || !user.resetOtp || !user.resetOtpExpires)
      return res.status(400).json({ message: 'No OTP request found' });

    if (user.resetOtp !== otp)
      return res.status(400).json({ message: 'Invalid OTP' });

    if (user.resetOtpExpires < new Date())
      return res.status(400).json({ message: 'OTP expired' });

    user.resetOtpVerified = true;
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('verifyOtp error:', error);
    return res.status(500).json({ message: 'Failed to verify OTP', error: error.message });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ message: 'Email and newPassword are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.resetOtpVerified || !user.resetOtpExpires || user.resetOtpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP not verified or expired' });
    }

    user.password = newPassword; // will be hashed by pre-save hook
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpVerified = false;
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('resetPassword error:', error);
    return res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

// PUT /api/user/update (protected)
exports.updateProfile = async (req, res) => {
  try {
    console.log('[updateProfile] start');
    console.log('[updateProfile] headers.authorization:', req.headers?.authorization);
    console.log('[updateProfile] req.user:', req.user);
    console.log('[updateProfile] req.body:', req.body);
    const userId = req.user?.userId || req.user?._id || req.userId;
    // Fallback to token payload via authMiddleware
    const id = userId || req.user?.id || req.user?.userId;
    const targetId = id || (req.user && req.user._id);
    if (!targetId && !req.body?.email) return res.status(401).json({ message: 'Unauthorized' });

    const { name, phone, address, email } = req.body;
    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (address) {
      update.address = {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.zip || '',
        country: address.country || '',
      };
    }
    console.log('[updateProfile] targetId:', targetId, 'email fallback:', email);
    console.log('[updateProfile] update payload:', update);

    let updated;
    if (targetId) {
      updated = await User.findByIdAndUpdate(targetId, { $set: update }, { new: true })
      .select('-password');
    } else if (email) {
      updated = await User.findOneAndUpdate({ email }, { $set: update }, { new: true }).select('-password');
    }
    console.log('[updateProfile] updated user:', updated?._id);
    if (!updated) return res.status(404).json({ message: 'User not found' });
    console.log('[updateProfile] success');
    return res.status(200).json({ message: 'Profile updated successfully', user: updated });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ message: 'Profile update failed', error: error.message });
  }
};
