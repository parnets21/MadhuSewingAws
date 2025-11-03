const Content = require("../models/content1");
const fs = require("fs");
const path = require("path");

// Get the latest content
const getContent = async (req, res) => {
    try {
        const content = await Content.findOne().sort({ createdAt: -1 });
        if (!content) {
            return res.status(404).json({ message: "No content found" });
        }
        res.json(content);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch content", error });
    }
};


// Add new content
const postContent = async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: "Image is required" });
        }

        const newContent = new Content({
            title,
            description,
            image: req.file.filename
        });

        await newContent.save();
        res.status(201).json({ 
            message: "Content added successfully!", 
            content: newContent 
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to add content", error });
    }
};

// Update existing content
const updateContent = async (req, res) => {
    try {
        const { title, description } = req.body;
        let content = await Content.findOne().sort({ createdAt: -1 });

        if (!content) {
            return res.status(404).json({ message: "No content found to update" });
        }

        // Delete old image if new one is uploaded
        if (req.file && content.image) {
            const oldImagePath = path.join(__dirname, "..", "uploads", content.image);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
            content.image = req.file.filename;
        }

        content.title = title || content.title;
        content.description = description || content.description;

        await content.save();
        res.json({ message: "Content updated successfully!", content });
    } catch (error) {
        res.status(500).json({ message: "Failed to update content", error });
    }
};

// Delete content
const deleteContent = async (req, res) => {
    try {
        const { id } = req.params;
        const content = await Content.findById(id);

        if (!content) {
            return res.status(404).json({ message: "Content not found" });
        }

        // Delete image from server
        const imagePath = path.join(__dirname, "..", "uploads", content.image);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await Content.findByIdAndDelete(id);
        res.json({ message: "Content deleted successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete content", error });
    }
};

module.exports = {
    getContent,
    postContent,
    updateContent,
    deleteContent
};