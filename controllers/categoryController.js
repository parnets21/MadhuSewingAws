const Category = require("../models/Category");

// Fetch all categories
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Add category
exports.addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const categoryimg = req.files?.[0]?.filename; // Get uploaded image

        if (!name || !categoryimg) {
            return res.status(400).json({ error: "Name and image are required" });
        }

        const newCategory = new Category({ name, categoryimg });
        await newCategory.save();

        res.status(201).json({ message: "Category added successfully", category: newCategory });
    } catch (error) {
        console.error("Error adding category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// ✅ DELETE category
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCategory = await Category.findByIdAndDelete(id);

        if (!deletedCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        res.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
   