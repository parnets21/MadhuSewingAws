const SalesBanner = require("../models/Sales");
const fs = require("fs");
const path = require("path");

// Add or Replace Sales Banner
const addSalesBanner = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload an image file"
            });
        }

        // Delete existing banner if any
        const existingBanner = await SalesBanner.findOne();
        if (existingBanner) {
            const oldImagePath = path.join(__dirname, "../uploads", existingBanner.image);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
            await SalesBanner.deleteMany({});
        }

        const newBanner = new SalesBanner({
            image: req.file.filename
        });

        await newBanner.save();

        res.status(201).json({
            success: true,
            message: "Banner uploaded successfully",
            imageUrl: `/uploads/${req.file.filename}`
        });
    } catch (error) {
        console.error("Banner upload error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload banner",
            error: error.message
        });
    }
};

// Delete Sales Banner
const deleteSalesBanner = async (req, res) => {
    try {
        const banner = await SalesBanner.findOne();
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: "No banner found to delete"
            });
        }

        const imagePath = path.join(__dirname, "../uploads", banner.image);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await SalesBanner.deleteOne({});

        res.json({
            success: true,
            message: "Banner deleted successfully"
        });
    } catch (error) {
        console.error("Banner delete error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete banner",
            error: error.message
        });
    }
};

// Get Current Banner
const getSalesBanner = async (req, res) => {
    try {
        const banner = await SalesBanner.findOne();
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: "No banner found"
            });
        }

        res.json({
            success: true,
            imageUrl: `/uploads/${banner.image}`
        });
    } catch (error) {
        console.error("Banner fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch banner",
            error: error.message
        });
    }
};

module.exports = {
    addSalesBanner,
    deleteSalesBanner,
    getSalesBanner
};
