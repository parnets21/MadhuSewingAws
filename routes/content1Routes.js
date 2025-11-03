const express = require("express");
const multer = require("multer");
const {
    getContent,
    postContent,
    updateContent,
    deleteContent
} = require("../controllers/content1Controller");

const router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Content routes
router.get("/", getContent);
router.post("/", upload.single("image"), postContent);
router.put("/", upload.single("image"), updateContent);
router.delete("/:id", deleteContent);

module.exports = router;