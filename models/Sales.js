// Rename this file to salesBanner.js
const mongoose = require("mongoose");

const SalesBannerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: [true, "Image filename is required"],
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for image URL
SalesBannerSchema.virtual('imageUrl').get(function () {
    return `/uploads/${this.image}`;
});

const SalesBanner = mongoose.model("SalesBanner", SalesBannerSchema);

module.exports = SalesBanner;
