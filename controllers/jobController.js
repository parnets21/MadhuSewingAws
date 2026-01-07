const Job = require('../models/Job');
const ServiceRequest = require('../models/ServiceRequest');
const Technician = require('../models/Technician');
const asyncHandler = require('express-async-handler');

// @desc    Get jobs for a technician
// @route   GET /api/jobs/technician/:technicianId
// @access  Private
const getTechnicianJobs = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { technicianId } = req.params;

 let query = { technicianId: technicianId };
  if (status) {
    query.status = status;
  }

  const jobs = await Job.find(query)
    .populate('serviceRequest')
    .populate('technicianId', 'name phone')
    .sort('-createdAt');

  res.json({
    success: true,
    count: jobs.length,
    data: jobs
  });
});   
// @desc    Get jobs for a technician
// @route   GET /api/jobs/technician/:technicianId
// @access  Private
// const getTechnicianJobs = asyncHandler(async (req, res) => {
//   const { status } = req.query;
//   const { technicianId } = req.params;

//   const query = { technician: technicianId };
//   if (status) {
//     query.status = status;
//   }

//   const jobs = await Job.find(query)
//     .populate({
//       path: 'serviceRequest',
//       select: 'firstName lastName phoneNumber address city brand model'
//     })
//     .populate({
//       path: 'technician',
//       select: 'name phone'
//     })
//     .sort('-createdAt');

//   res.json({
//     success: true,
//     count: jobs.length,
//     data: jobs
//   });
// });




// @desc    Update job status
// @route   PATCH /api/jobs/:jobId/status
// @access  Private
const updateJobStatus = asyncHandler(async (req, res) => {
  const { status, latitude, longitude } = req.body;
  
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  job.status = status;
  const updatedJob = await job.save();

  // If job is accepted, update technician location
  if (status === 'accepted' && latitude && longitude) {
    try {
      const technician = await Technician.findById(job.technicianId);
      if (technician) {
        // Update location using the existing location update logic
        const axios = require('axios');
        let address = '';
        
        try {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`
          );
          
          if (response.data.results && response.data.results.length > 0) {
            address = response.data.results[0].formatted_address;
          }
        } catch (geocodeError) {
          console.error('Geocoding error:', geocodeError);
        }

        // Update current location
        technician.currentLocation = {
          latitude,
          longitude,
          address,
          lastUpdated: new Date()
        };

        // Add to location history with job reference
        technician.locationHistory.push({
          latitude,
          longitude,
          address,
          timestamp: new Date(),
          jobId: job._id
        });

        // Keep only last 100 location history entries
        if (technician.locationHistory.length > 100) {
          technician.locationHistory = technician.locationHistory.slice(-100);
        }

        await technician.save();
      }
    } catch (locationError) {
      console.error('Error updating technician location:', locationError);
      // Don't fail the job status update if location update fails
    }
  }

  if (status === 'completed') {
    await ServiceRequest.findByIdAndUpdate(
      job.serviceRequest,
      { status: 'Completed' }
    );
  }

  res.json({
    success: true,
    data: updatedJob
  });
});

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private/Admin

const createJob = asyncHandler(async (req, res) => {
  const job = await Job.create(req.body);
  res.status(201).json({
    success: true,
    data: job
  });
});

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Private/Admin
const getAllJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find()
    .populate('serviceRequest')
    .populate('technicianId', 'name phone')
    .sort('-createdAt');

  res.json({
    success: true,
    count: jobs.length,
    data: jobs
  });
});

// @desc    Get job by ID
// @route   GET /api/jobs/:id
// @access  Private
const getJobById = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate('serviceRequest')
    .populate('technicianId', 'name phone');

  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  res.json({
    success: true,
    data: job
  });
});     


// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
const updateJob = asyncHandler(async (req, res) => {
  let job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  job = await Job.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: job
  });
});

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private/Admin
const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  await job.deleteOne();

  res.json({
    success: true,
    data: {}
  });
});

module.exports = {
  getTechnicianJobs,
  updateJobStatus,
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob
};
