// const Footer = require("../models/Footer");

// // Get Footer Content
// exports.getFooter = async (req, res) => {
//   try {
//     const footer = await Footer.findOne();
//     if (!footer) {
//       return res.status(404).json({ message: "Footer content not found" });
//     }
//     res.status(200).json(footer);
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error });
//   }
// };

// // Update Footer Content (No authentication required)
// exports.updateFooter = async (req, res) => {
//   try {
//     const {
//       aboutUs,
//       shopByCategory,
//       chooseByBrand,
//       contactInfo,
//       copyright,
//       developedBy,
//       links,
//     } = req.body;

//     const footer = await Footer.findOneAndUpdate(
//       {},
//       {
//         aboutUs,
//         shopByCategory,
//         chooseByBrand,
//         contactInfo,
//         copyright,
//         developedBy,
//         links,
//       },
//       { new: true, upsert: true }
//     );

//     res.status(200).json({ message: "Footer updated successfully", footer });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error });
//   }
// };



const Footer = require("../models/Footer");

// Get Footer Content
exports.getFooter = async (req, res) => {
  try {
    const footer = await Footer.findOne();
    if (!footer) {
      return res.status(404).json({ message: "Footer content not found" });
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Footer Content (No authentication required)
exports.updateFooter = async (req, res) => {
  try {
    const {
      aboutUs,
      shopByCategory,
      chooseByBrand,
      contactInfo,
      copyright,
      developedBy,
      links,
    } = req.body;

    const footer = await Footer.findOneAndUpdate(
      {},
      {
        aboutUs,
        shopByCategory,
        chooseByBrand,
        contactInfo,
        copyright,
        developedBy,
        links,
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Footer updated successfully", footer });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create Footer Content
exports.createFooter = async (req, res) => {
  try {
    // First, delete any existing footer configurations
    await Footer.deleteMany({});

    const footer = new Footer(req.body);
    const savedFooter = await footer.save();
    res.status(201).json({ message: "Footer created successfully", footer: savedFooter });
  } catch (error) {
    res.status(400).json({ message: "Error creating footer", error: error.message });
  }
};

// Delete Footer Content
exports.deleteFooter = async (req, res) => {
  try {
    await Footer.deleteMany({});
    res.status(200).json({ message: "Footer configuration deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};