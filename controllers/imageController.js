const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const unlinkAsync = promisify(fs.unlink);

const uploadDir = path.join(__dirname, '../uploads/images');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files were uploaded' });
    }

    const uploadedFiles = [];
    for (const file of req.files) {
      const filename = `${Date.now()}-${file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      await writeFileAsync(filePath, file.buffer);
      uploadedFiles.push(`/uploads/images/${filename}`);
    }

    res.status(201).json({
      message: 'Images uploaded successfully',
      images: uploadedFiles
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
};

const getUploadedImages = async (req, res) => {
  try {
    const files = await readdirAsync(uploadDir);
    const images = files.map(file => `/uploads/images/${file}`);
    res.status(200).json({ images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ message: 'Failed to fetch images', error: error.message });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Image not found' });
    }

    await unlinkAsync(filePath);
    res.status(200).json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Failed to delete image', error: error.message });
  }
};

module.exports = {
  uploadImages,
  getUploadedImages,
  deleteImage
};