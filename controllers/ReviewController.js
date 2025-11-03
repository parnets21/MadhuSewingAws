const Testimonial = require("../models/Review");                

// ✅ Get all testimonials
exports.getAllTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find();
    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ error: "Error fetching testimonials" });
  }
};

// ✅ Add a new testimonial
exports.addTestimonial = async (req, res) => {
  try {
    const { name, location, review, rating } = req.body;
    const image = req.file ? req.file.filename : null;

    const newTestimonial = new Testimonial({
      name,
      location,
      review,
      rating,
      image,
    });

    await newTestimonial.save();
    res.status(201).json({ message: "Testimonial added successfully", newTestimonial });
  } catch (error) {
    res.status(500).json({ error: "Error adding testimonial" });
  }
};

// ✅ Update testimonial (only rating, image, and review)
exports.updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const image = req.file ? req.file.filename : null;

    const updatedFields = {};
    if (rating) updatedFields.rating = rating;
    if (review) updatedFields.review = review;
    if (image) updatedFields.image = image;

    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      id,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedTestimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    res.json({ message: "Testimonial updated successfully", updatedTestimonial });
  } catch (error) {
    res.status(500).json({ error: "Error updating testimonial" });
  }
};

// ✅ Delete a testimonial
exports.deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    await Testimonial.findByIdAndDelete(id);
    res.json({ message: "Testimonial deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting testimonial" });
  }
};
