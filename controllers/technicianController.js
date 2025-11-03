const Technician = require('../models/Technician');
const ServiceRequest = require('../models/ServiceRequest');
const Job = require('../models/Job');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

// @desc    Register a new technician
// @route   POST /api/technicians
// @access  Public
const registerTechnician = asyncHandler(async (req, res) => {
  const { name, email, phone, address, experience, password } = req.body;

  // Check if technician already exists
  const technicianExists = await Technician.findOne({ email });
  if (technicianExists) {
    res.status(400);
    throw new Error('Technician with this email already exists');
  }

  // Create new technician
  const technician = await Technician.create({
    name,
    email,
    phone,
    address,
    experience,
    password,
  });

  if (technician) {
    res.status(201).json({
      _id: technician._id,
      name: technician.name,
      email: technician.email,
      phone: technician.phone,
      token: generateToken(technician._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid technician data');
  }
});

// @desc    Authenticate technician & get token
// @route   POST /api/technicians/login
// @access  Public
const loginTechnician = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide both email and password');
  }

  const technician = await Technician.findOne({ email }).select('+password');

  if (!technician || !(await technician.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  res.json({
    _id: technician._id,
    name: technician.name,
    email: technician.email,
    phone: technician.phone,
    token: generateToken(technician._id),
  });
});

// @desc    Assign technician to service request and create job
// @route   PUT /api/technicians/:id/assign-technician
// @access  Private
const assignTechnician = asyncHandler(async (req, res) => {
  const { technicianId } = req.body;
  const { id } = req.params;
 try {
   const serviceRequest = await ServiceRequest.findById(id);
   if (!serviceRequest) {
     res.status(404);
     throw new Error('Service request not found');
   }

   const technician = await Technician.findById(technicianId);
   if (!technician) {
     res.status(404);
     throw new Error('Technician not found');
   }

   // Update service request
   serviceRequest.status = 'Assigned';
   serviceRequest.technician = technician._id;
   await serviceRequest.save();

   // Create a new job for the technician
   const job = await Job.create({
     technicianId: technician._id,
     serviceRequest: serviceRequest._id,
     user: {
       name: serviceRequest.firstName + ' ' + serviceRequest.lastName,  // or just firstName
       address: serviceRequest.address,
       phone: serviceRequest.phoneNumber,
     },
     amount: serviceRequest.amount,
     scheduledDate: serviceRequest.scheduledDate,
     scheduledTime: serviceRequest.scheduledTime,
     description: serviceRequest.description,
     lat: serviceRequest.lat,
     lng: serviceRequest.lng,
     status: 'upcoming'
   });



   res.json({
     success: true,
     data: {
       serviceRequest,
       job
     },
     message: 'Technician assigned and job created successfully'
   });
 } catch (error) {
   console.log(error);
   res.status(500).json({
     success: false,
     message: 'Internal server error',
     error: error.message
   });
 }

});

// @desc    Get single technician
// @route   GET /api/technicians/:id
// @access  Public
const getTechnicianById = asyncHandler(async (req, res) => {
  const technician = await Technician.findById(req.params.id).select('-password');

  if (technician) {
    res.json(technician);
  } else {
    res.status(404);
    throw new Error('Technician not found');
  }
});

// @desc    Update technician profile
// @route   PUT /api/technicians/profile/update
// @access  Private
const updateTechnician = asyncHandler(async (req, res) => {
  const technician = await Technician.findById(req.user.id);

  if (!technician) {
    res.status(404);
    throw new Error('Technician not found');
  }

  technician.name = req.body.name || technician.name;
  technician.email = req.body.email || technician.email;
  technician.phone = req.body.phone || technician.phone;
  technician.address = req.body.address || technician.address;
  technician.experience = req.body.experience || technician.experience;
  technician.skills = req.body.skills || technician.skills;
  technician.isAvailable = req.body.isAvailable !== undefined ? req.body.isAvailable : technician.isAvailable;

  const updatedTechnician = await technician.save();

  res.json({
    success: true,
    data: {
      _id: updatedTechnician._id,
      name: updatedTechnician.name,
      email: updatedTechnician.email,
      phone: updatedTechnician.phone,
      address: updatedTechnician.address,
      experience: updatedTechnician.experience,
      skills: updatedTechnician.skills,
      isAvailable: updatedTechnician.isAvailable
    }
  });
});

// @desc    Get all technicians
// @route   GET /api/technicians
// @access  Public
const getTechnicians = asyncHandler(async (req, res) => {
  const technicians = await Technician.find({}).select('-password');
  res.json({
    success: true,
    count: technicians.length,
    data: technicians
  });
});

// @desc    Get current technician profile
// @route   GET /api/technicians/profile/me
// @access  Private
const getCurrentTechnician = asyncHandler(async (req, res) => {
  const technician = await Technician.findById(req.user.id).select('-password');

  if (!technician) {
    res.status(404);
    throw new Error('Technician not found');
  }

  res.json({
    success: true,
    data: technician
  });
});

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = {
  registerTechnician,
  loginTechnician,
  getTechnicians,
  getTechnicianById,
  getCurrentTechnician,
  updateTechnician,
  assignTechnician
};
