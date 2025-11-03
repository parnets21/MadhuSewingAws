const Brand = require("../models/Brand");

// 🛒 Create a new brand (Admin Only)
exports.createBrand = async (req, res) => {
  try {
    const { name } = req.body;
    const logo = req.file ? req.file.filename : null;

    if (!name || !logo) {
      return res.status(400).json({ success: false, message: "Name and logo are required!" });
    }

    const brand = new Brand({ name, logo });
    await brand.save();
    res.status(201).json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🛒 Get all brands
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json({ success: true, brands });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🛒 Get a single brand by ID
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.status(200).json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🛒 Update a brand (Admin Only) - Only Name & Logo
exports.updateBrand = async (req, res) => {
  try {
    const { name } = req.body;
    const logo = req.file ? req.file.filename : undefined;

    const updateData = {};
    if (name) updateData.name = name;
    if (logo) updateData.logo = logo;

    const brand = await Brand.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.status(200).json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🛒 Delete a brand (Admin Only)
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.status(200).json({ success: true, message: "Brand deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
