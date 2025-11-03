const Job = require('../models/Job');
const ServiceRequest = require('../models/ServiceRequest');
const asyncHandler = require('express-async-handler');

// @desc    Get jobs for a technician
// @route   GET /api/jobs/technician/:technicianId
// @access  Private
const getTechnicianJobs = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { technicianId } = req.params;

 let query = { technician: technicianId };
  if (status) {
    query.status = status;
  }

  const jobs = await Job.find(query)
    .populate('serviceRequest')
    .populate('technician', 'name phone')
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
  const { status } = req.body;
  
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  job.status = status;
  const updatedJob = await job.save();

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
