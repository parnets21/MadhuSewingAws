const Banner = require("../models/Banner");
const fs = require("fs");
const path = require("path");


const getBanner = async (req, res) => {
    try {
        const banner = await Banner.findOne().sort({ _id: -1 }); 
        if (!banner) {
            return res.status(404).json({ message: "No banner found" });
        }
        res.json(banner);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch banner", error });
    }
};

// 📌 Add a new banner (POST)
const postBanner = async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: "Image is required" });
        }

        const newBanner = new Banner({
            title,
            description,
            image: req.file.filename, // Store only the filename
        });

        await newBanner.save();
        res.json({ message: "Banner added successfully!", newBanner });
    } catch (error) {
        res.status(500).json({ message: "Failed to add banner", error });
    }
};

// 📌 Update the existing banner (PUT)
const updateBanner = async (req, res) => {
    try {
        const { title, description } = req.body;
        let banner = await Banner.findOne(); // Find the existing banner

        if (!banner) {
            return res.status(404).json({ message: "No banner found to update" });
        }

        // Delete old image if a new one is uploaded
        if (req.file && banner.image) {
            const oldImagePath = path.join(__dirname, "..", "uploads", banner.image);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
            banner.image = req.file.filename;
        }

        banner.title = title || banner.title;
        banner.description = description || banner.description;

        await banner.save();

        res.json({ message: "Banner updated successfully!", banner });
    } catch (error) {
        res.status(500).json({ message: "Failed to update banner", error });
    }
};

// 📌 Delete a banner (DELETE)
const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await Banner.findById(id);

        if (!banner) {
            return res.status(404).json({ message: "Banner not found" });
        }

        // Delete banner image from server
        const imagePath = path.join(__dirname, "..", "uploads", banner.image);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await Banner.findByIdAndDelete(id);
        res.json({ message: "Banner deleted successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete banner", error });
    }
};

module.exports = { getBanner, postBanner, updateBanner, deleteBanner };
