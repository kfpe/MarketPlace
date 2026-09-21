// 1. IMPORTATIONS DES MODULES ET CONFIGURATION
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importer la connexion PostgreSQL
const db = require('./config/db');

// Importer les middlewares personnalisés
const errorHandler = require('./middlewares/errorHandler');

// Importer toutes les routes
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const boutiqueRoutes = require('./routes/boutiqueRoutes');
const produitRoutes = require('./routes/produitRoutes');
const panierRoutes = require('./routes/panierRoutes');
const commandeRoutes = require('./routes/commandeRoutes');
const discussionRoutes = require('./routes/discussionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// 2. INITIALISATION DE L'APPLICATION
const app = express();
const PORT = process.env.PORT || 3000;

// 3. MIDDLEWARES GLOBAUX
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendre le dossier 'uploads' accessible publiquement
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 4. DECLARATION DES ROUTES API
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/boutiques', boutiqueRoutes);
app.use('/api/produits', produitRoutes);
app.use('/api/cart', panierRoutes);
app.use('/api/commandes', commandeRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Route d'accueil & documentation rapide
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Bienvenue sur l\'API de ProjetBoutik - Marketplace Locale !',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            categories: '/api/categories',
            boutiques: '/api/boutiques',
            produits: '/api/produits',
            cart: '/api/cart',
            commandes: '/api/commandes',
            discussions: '/api/discussions',
            notifications: '/api/notifications',
            admin: '/api/admin',
            upload: '/api/upload'
        }
    });
});

// 5. GESTION DES ROUTES INEXISTANTES (404)
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `La route demandée '${req.originalUrl}' n'existe pas.`
    });
});

// 6. GESTIONNAIRE D'ERREURS GLOBAL
app.use(errorHandler);

// 7. DEMARRAGE DU SERVEUR
app.listen(PORT, () => {
    console.log(`🚀 Le serveur ProjetBoutik tourne sur http://localhost:${PORT}`);
});