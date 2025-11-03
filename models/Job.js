const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technician',
    required: [true, 'Technician ID is required'],
  },  
  // technician: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Technician',
  //   required: [true, 'Technician is required'],
  // },

  serviceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true
  },
  user: {
    name: { type: String, required: [true, 'User name is required'] },  
    address: { type: String, required: [true, 'address is required'] },
    phone: { type: String, required: [true, 'User phone is required'] },
  },
  scheduledDate: {
    type: Date,
    // required: [true, 'Scheduled date is required'],
  },
  scheduledTime: {
    type: String,
    // required: [true, 'Scheduled time is required'],
  },
  description: {
    type: String,
    trim: true,
  },
  lat: {
    type: Number,
    // required: [true, 'Latitude is required'],
    min: [-90, 'Invalid latitude'],
    max: [90, 'Invalid latitude'],
  },
  lng: {
    type: Number,
    // required: [true, 'Longitude is required'],
    min: [-180, 'Invalid longitude'],
    max: [180, 'Invalid longitude'],
  },
  status: {       
    type: String,
    enum: {
      values: ['upcoming', 'accepted', 'completed', 'rejected'],
      message: 'Invalid status',
    },
    default: 'upcoming',
  }
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
