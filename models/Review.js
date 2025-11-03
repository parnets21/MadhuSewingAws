const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  review: { type: String, required: true },
  rating: { type: Number, required: true },
  image: { type: String, required: false }, // Image is optional
});

module.exports = mongoose.model("Testimonial", testimonialSchema);
