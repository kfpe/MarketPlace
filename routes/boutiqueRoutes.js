const express = require('express');
const router = express.Router();
const boutiqueController = require('../controllers/boutiqueController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Routes publiques
router.get('/', boutiqueController.getBoutiques);
router.get('/:id', boutiqueController.getBoutiqueById);
router.get('/:id/avis', boutiqueController.getAvis);
router.post('/:id/click-whatsapp', boutiqueController.incrementWhatsappClick);
router.post('/:id/click-call', boutiqueController.incrementCallClick);

// Routes pour vendeurs connectés (ou clients créant leur boutique)
router.get('/my/shop', protect, boutiqueController.getMyBoutique);
router.post('/', protect, boutiqueController.createBoutique);
router.put('/:id', protect, boutiqueController.updateBoutique);

// Route pour clients connectés (avis)
router.post('/:id/avis', protect, boutiqueController.addAvis);

module.exports = router;
