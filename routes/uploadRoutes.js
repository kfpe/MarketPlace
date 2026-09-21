const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const { protect } = require('../middlewares/authMiddleware');

// @desc    Téléverser une image (logo, photo de produit)
// @route   POST /api/upload/single
router.post('/single', protect, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Veuillez sélectionner une image à téléverser.'
        });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({
        success: true,
        message: 'Image téléversée avec succès.',
        data: {
            filename: req.file.filename,
            url: fileUrl
        }
    });
});

// @desc    Téléverser plusieurs images (galerie de produit)
// @route   POST /api/upload/multiple
router.post('/multiple', protect, upload.array('images', 5), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Veuillez sélectionner au moins une image.'
        });
    }

    const filesData = req.files.map(file => ({
        filename: file.filename,
        url: `/uploads/${file.filename}`
    }));

    res.status(200).json({
        success: true,
        message: `${req.files.length} images téléversées avec succès.`,
        data: filesData
    });
});

module.exports = router;
