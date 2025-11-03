const Product = require("../models/Product");

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json({ products });
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
};

// Add a new product
const addProduct = async (req, res) => {
  try {
    // Parse form data
    const productData = {
      name: req.body.name,
      type: req.body.type,
      price: parseFloat(req.body.price),
      originalPrice: parseFloat(req.body.originalPrice),
      discount: req.body.discount,
      brand: req.body.brand,
      description: req.body.description,
      isTrending: req.body.isTrending === 'true',
      isTopDiscounted: req.body.isTopDiscounted === 'true',
      features: JSON.parse(req.body.features),
      specification: JSON.parse(req.body.specification),
    };

    // Handle images
    if (req.files && req.files.length > 0) {
      productData.images = req.files.map(file => `${file.filename}`);
    } else if (req.body.existingImages) {
      // Handle existing images when editing
      productData.images = Array.isArray(req.body.existingImages) 
        ? req.body.existingImages 
        : [req.body.existingImages];
    } else {
      productData.images = [];
    }

    const newProduct = new Product(productData);
    await newProduct.save();
    
    res.status(201).json({ 
      message: "Product added successfully", 
      product: newProduct 
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ 
        message: "Validation Error", 
        error: error.message 
      });
    }
    res.status(500).json({ 
      message: "Error adding product", 
      error: error.message 
    });
  }
};

// Update a product
const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({ message: "Product updated successfully", updatedProduct });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation Error", error: error.message });
    }
    res.status(500).json({ message: "Error updating product", error });
  }
};

// Delete a product
const deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
};   
 
const getProductByid = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
      
    }
    res.status(200).json({ message: "Product fetched successfully", data: product });
  
  }
  catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
}

  const getTrandingProduct = async (req, res) => {
    try {
      const trendingProducts = await Product.find({ isTrending: true });
      res.status(200).json({ products: trendingProducts });
    } catch (error) {
      res.status(500).json({ message: "Error fetching trending products", error });
    }
  }
 
  const importProducts = async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: "Invalid products data" });
    }

    // Insert multiple products
    const result = await Product.insertMany(products);
    
    res.status(201).json({ 
      message: "Products imported successfully",
      count: result.length
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ 
        message: "Validation Error", 
        error: error.message 
      });
    }
    res.status(500).json({ 
      message: "Error importing products", 
      error: error.message 
    });
  }
};

module.exports = {
  getAllProducts,
  addProduct,
  updateProduct,
  deleteProduct, 
  getProductByid,
  getTrandingProduct,
  importProducts
};