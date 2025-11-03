const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    logo: { type: String, required: true }, // Stores the filename
    bgColor: { type: String, default: "#ffffff" }, // Default value
    textColor: { type: String, default: "text-dark" }, // Default text color
    deliveryInfo: { type: String, default: "🚚 Deliver in 24 hours" }, // Default message
  },
  { timestamps: true }
);

module.exports = mongoose.model("Brand", brandSchema);
