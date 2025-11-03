const mongoose = require("mongoose");

const footerSchema = new mongoose.Schema({
  aboutUs: {
    description: { type: String, required: true },
    socialMedia: {
      facebook: { type: String, default: "#" },
      instagram: { type: String, default: "#" },
      twitter: { type: String, default: "#" },
    },
  },
  shopByCategory: [
    {
      name: { type: String, required: true },
      link: { type: String, default: "#" },
    },
  ],
  chooseByBrand: [
    {
      name: { type: String, required: true },
      link: { type: String, default: "#" },
    },
  ],
  contactInfo: {
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
  },
  copyright: { type: String, required: true },
  developedBy: { type: String, required: true },
  links: {
    privacyPolicy: { type: String, default: "#" },
    termsAndConditions: { type: String, default: "#" },
  },
}, { timestamps: true });

module.exports = mongoose.model("Footer", footerSchema);