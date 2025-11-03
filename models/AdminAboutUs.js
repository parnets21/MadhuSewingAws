const mongoose = require("mongoose");

const AdminAboutUsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: "admin_aboutus" }
);

module.exports = mongoose.model("AdminAboutUs", AdminAboutUsSchema);
