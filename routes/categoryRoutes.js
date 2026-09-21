const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Routes publiques
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);

// Routes réservées aux Administrateurs
router.post('/', protect, authorize('ADMIN'), categoryController.createCategory);
router.put('/:id', protect, authorize('ADMIN'), categoryController.updateCategory);
router.delete('/:id', protect, authorize('ADMIN'), categoryController.deleteCategory);

module.exports = router;