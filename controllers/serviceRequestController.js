const ServiceRequest = require("../models/ServiceRequest");

// Create a new service request
exports.createServiceRequest = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const { firstName, lastName, address, city, phoneNumber, brand, model } = req.body;
    const imagePath = req.files?.image ? req.files.image[0].filename : null;
    const videoPath = req.files?.video ? req.files.video[0].filename : null;

    // Validate required fields
    if (!address || !phoneNumber || !brand || !model || !imagePath) {
      return res.status(400).json({
        success: false,
        message: "Address, phone, brand, model and image are required"
      });
    }

    const newRequest = new ServiceRequest({
      user: req.user._id,
      firstName,
      lastName,
      address,
      city,
      phoneNumber,
      brand,
      model,
      image: imagePath,
      video: videoPath, // Added video field
    });

    await newRequest.save();
    
    res.status(201).json({
      success: true,
      message: "Service request submitted successfully!",
      data: newRequest
    });
  } catch (error) {
    console.error("Error creating service request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit request",
      error: error.message
    });
  }
};   


// Get all service requests (admin only)
exports.getServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find()
      .sort({ createdAt: -1 })
      .populate("user", "firstName lastName email");

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error("Error fetching all service requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests",
      error: error.message
    });
  }
};

// Get service requests for current user
exports.getUserServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'firstName lastName email');

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error("Error fetching user service requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your service requests",
      error: error.message
    });
  }
};