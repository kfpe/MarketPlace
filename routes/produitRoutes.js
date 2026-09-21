const express = require('express');
const router = express.Router();
const produitController = require('../controllers/produitController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Routes publiques
router.get('/', produitController.getProduits);
router.get('/:id', produitController.getProduitById);

// Routes protégées pour vendeurs & admins
router.post('/', protect, authorize('VENDEUR', 'ADMIN'), produitController.createProduit);
router.put('/:id', protect, authorize('VENDEUR', 'ADMIN'), produitController.updateProduit);
router.delete('/:id', protect, authorize('VENDEUR', 'ADMIN'), produitController.deleteProduit);
router.patch('/:id/toggle-dispo', protect, authorize('VENDEUR', 'ADMIN'), produitController.toggleDisponibilite);

module.exports = router;
