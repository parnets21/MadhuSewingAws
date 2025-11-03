const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  discount: { type: String },
  images: [{
    url: { type: String, required: true },
    // name: { type: String, required: true }
  }],
  brand: { type: String },
  features: { type: [String] },
  description: { type: String, required: true },
  specification: {
    machineType: { type: String },
    numberOfStitches: { type: String },
    maxStitchWidth: { type: String },
    maxStitchLength: { type: String },
    needleThreadingSystem: { type: String },
    bobbinSystem: { type: String },
    motorSpeed: { type: String },
    presserFoot: { type: String },
    freeArm: { type: String },
    light: { type: String },
    weight: { type: String },
    warranty: { type: String }
  },
  isTrending: { type: Boolean, default: false },
  isTopDiscounted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
