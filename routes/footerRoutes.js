// const express = require("express");
// const router = express.Router();
// const footerController = require("../controllers/footerController");

// // Public route to get footer content
// router.get("/", footerController.getFooter);

// // ✅ No authentication, anyone can update footer
// router.put("/", footerController.updateFooter);

// module.exports = router;




// const express = require('express');
// const router = express.Router();
// const Footer = require('../models/Footer');

// // Create Footer Configuration
// router.post('/', async (req, res) => {
//   try {
//     // First, delete any existing footer configurations
//     await Footer.deleteMany({});

//     const footer = new Footer(req.body);
//     const savedFooter = await footer.save();
//     res.status(201).json(savedFooter);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

// // Get Footer Configuration
// router.get('/', async (req, res) => {
//   try {
//     const footer = await Footer.findOne();
//     if (!footer) {
//       return res.status(404).json({ message: 'No footer configuration found' });
//     }
//     res.json(footer);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Update Footer Configuration
// router.put('/', async (req, res) => {
//   try {
//     const footer = await Footer.findOne();
//     if (!footer) {
//       return res.status(404).json({ message: 'No footer configuration found' });
//     }

//     // Update each field
//     Object.keys(req.body).forEach(key => {
//       footer[key] = req.body[key];
//     });

//     const updatedFooter = await footer.save();
//     res.json(updatedFooter);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

// // Delete Footer Configuration
// router.delete('/', async (req, res) => {
//   try {
//     await Footer.deleteMany({});
//     res.json({ message: 'Footer configuration deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// module.exports = router;






const express = require('express');
const router = express.Router();
const {
  getFooter,
  updateFooter,
  createFooter,
  deleteFooter
} = require('../controllers/footerController');

// Get Footer Configuration
router.get('/', getFooter);

// Create Footer Configuration
router.post('/', createFooter);

// Update Footer Configuration
router.put('/', updateFooter);

// Delete Footer Configuration
router.delete('/', deleteFooter);

module.exports = router;