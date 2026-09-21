const express = require('express');
const router = express.Router();
const commandeController = require('../controllers/commandeController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);

// Création d'une commande (Client)
router.post('/', commandeController.createCommande);

// Historique de commandes
router.get('/my-orders', commandeController.getMyOrders);
router.get('/vendor-orders', authorize('VENDEUR', 'ADMIN'), commandeController.getVendorOrders);

// Détail et mise à jour de statut
router.get('/:id', commandeController.getOrderById);
router.patch('/:id/status', commandeController.updateOrderStatus);

module.exports = router;
