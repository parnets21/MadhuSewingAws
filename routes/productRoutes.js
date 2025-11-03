const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const upload = require("../middleware/upload");   
// Add this route in productRoutes.js


const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.originalname}`);
  }
});

const uploadMiddleware = multer({ storage });

// GET all products
router.get("/", productController.getAllProducts);

// POST a new product
router.post('/', upload.array('images', 5), productController.addProduct);
router.post("/uploadimages", uploadMiddleware.any(),(req, res) => {
  res.json({ message: "Images uploaded successfully" });
}   );

// PUT update a product
router.put("/:id", productController.updateProduct);

// DELETE a product
router.delete("/:id", productController.deleteProduct);     
router.get("/getproductbyid/:id", productController.getProductByid);    
// Backend: productRoutes.js
router.get("/trending", productController.getTrandingProduct); 
router.post("/import", productController.importProducts);

module.exports = router;