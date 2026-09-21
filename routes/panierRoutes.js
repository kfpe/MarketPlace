const express = require('express');
const router = express.Router();
const panierController = require('../controllers/panierController');
const { protect } = require('../middlewares/authMiddleware');

// Toutes les routes du panier sont réservées aux utilisateurs connectés (Clients)
router.use(protect);

router.get('/', panierController.getCart);
router.post('/items', panierController.addItemToCart);
router.put('/items/:id', panierController.updateCartItem);
router.delete('/items/:id', panierController.removeCartItem);
router.delete('/', panierController.clearCart);

module.exports = router;
