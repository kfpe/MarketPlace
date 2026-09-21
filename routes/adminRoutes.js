const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Toutes les routes d'administration nécessitent le rôle ADMIN
router.use(protect, authorize('ADMIN'));

// Métriques globales
router.get('/metrics', adminController.getMetrics);

// Modération des boutiques
router.get('/boutiques', adminController.getBoutiquesAdmin);
router.patch('/boutiques/:id/statut', adminController.updateBoutiqueStatut);

// Gestion des utilisateurs
router.get('/users', adminController.getUsersAdmin);
router.delete('/users/:id', adminController.deleteUserAdmin);

// Gestion des commandes globales
router.get('/commandes', adminController.getCommandesAdmin);

module.exports = router;
