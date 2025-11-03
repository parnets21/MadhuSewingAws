const express = require("express");
const router = express.Router();
const AdminAboutUs = require("../models/AdminAboutUs");

// ✅ Get About Us Data
router.get("/", async (req, res) => {
    try {
        const aboutUs = await AdminAboutUs.findOne();
        res.json(aboutUs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ Create About Us Entry
router.post("/", async (req, res) => {
    const { title, description } = req.body;

    try {
        let aboutUs = await AdminAboutUs.findOne();
        if (aboutUs) {
            return res.status(400).json({ message: "About Us already exists. Use update instead." });
        }

        aboutUs = new AdminAboutUs({ title, description });
        await aboutUs.save();
        res.status(201).json(aboutUs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ Update About Us Data
router.put("/:id", async (req, res) => {
    try {
        const { title, description } = req.body;
        const updatedAboutUs = await AdminAboutUs.findByIdAndUpdate(
            req.params.id,
            { title, description, updatedAt: Date.now() },
            { new: true }
        );

        if (!updatedAboutUs) {
            return res.status(404).json({ message: "About Us not found" });
        }

        res.json(updatedAboutUs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ Delete About Us Data
router.delete("/:id", async (req, res) => {
    try {
        const deletedAboutUs = await AdminAboutUs.findByIdAndDelete(req.params.id);

        if (!deletedAboutUs) {
            return res.status(404).json({ message: "About Us not found" });
        }

        res.json({ message: "About Us deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
