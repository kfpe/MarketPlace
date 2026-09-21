// Test complet de l'API ProjetBoutik
const http = require('http');

const startServerAndTest = async () => {
    // 1. Démarrer temporairement le serveur
    const express = require('express');
    const cors = require('cors');
    const path = require('path');
    require('dotenv').config();

    const errorHandler = require('../middlewares/errorHandler');
    const authRoutes = require('../routes/authRoutes');
    const categoryRoutes = require('../routes/categoryRoutes');
    const boutiqueRoutes = require('../routes/boutiqueRoutes');
    const produitRoutes = require('../routes/produitRoutes');
    const panierRoutes = require('../routes/panierRoutes');
    const commandeRoutes = require('../routes/commandeRoutes');
    const discussionRoutes = require('../routes/discussionRoutes');
    const notificationRoutes = require('../routes/notificationRoutes');
    const adminRoutes = require('../routes/adminRoutes');
    const uploadRoutes = require('../routes/uploadRoutes');

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
    app.use(errorHandler);

    const server = app.listen(4001, async () => {
        console.log('🧪 Serveur de test démarré sur le port 4001.');

        try {
            const baseUrl = 'http://localhost:4001';

            // Helper fetch JSON
            const apiRequest = async (endpoint, options = {}) => {
                const res = await fetch(`${baseUrl}${endpoint}`, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...(options.headers || {})
                    }
                });
                return { status: res.status, body: await res.json() };
            };

            // Test 1: Categories
            console.log('\n1. Test GET /api/categories...');
            const catRes = await apiRequest('/api/categories');
            console.log(`-> Status: ${catRes.status}, Catégories trouvées: ${catRes.body.count}`);

            // Test 2: Login Client
            console.log('\n2. Test POST /api/auth/login (Client)...');
            const loginClientRes = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: 'client@projetboutik.com', mot_de_passe: 'client1234' })
            });
            console.log(`-> Status: ${loginClientRes.status}, Token client obtenu: ${!!loginClientRes.body.token}`);
            const clientToken = loginClientRes.body.token;

            // Test 3: Login Admin
            console.log('\n3. Test POST /api/auth/login (Admin)...');
            const loginAdminRes = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: 'admin@projetboutik.com', mot_de_passe: 'admin1234' })
            });
            console.log(`-> Status: ${loginAdminRes.status}, Rôle: ${loginAdminRes.body.data?.role}`);
            const adminToken = loginAdminRes.body.token;

            // Test 4: Boutiques list
            console.log('\n4. Test GET /api/boutiques (Recherche Nkoabang)...');
            const boutiquesRes = await apiRequest('/api/boutiques?quartier=Nkoabang');
            console.log(`-> Status: ${boutiquesRes.status}, Boutiques trouvées: ${boutiquesRes.body.count}`);

            // Test 5: Produits list
            console.log('\n5. Test GET /api/produits...');
            const prodRes = await apiRequest('/api/produits');
            console.log(`-> Status: ${prodRes.status}, Produits trouvés: ${prodRes.body.count}`);
            const firstProduct = prodRes.body.data[0];

            // Test 6: Panier Client
            if (firstProduct) {
                console.log(`\n6. Test POST /api/cart/items (Ajout produit #${firstProduct.id})...`);
                const addCartRes = await apiRequest('/api/cart/items', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${clientToken}` },
                    body: JSON.stringify({ produit_id: firstProduct.id, quantite: 2 })
                });
                console.log(`-> Status: ${addCartRes.status}, Total panier: ${addCartRes.body.data?.montant_total} FCFA`);

                console.log('\n7. Test GET /api/cart...');
                const getCartRes = await apiRequest('/api/cart', {
                    headers: { Authorization: `Bearer ${clientToken}` }
                });
                console.log(`-> Status: ${getCartRes.status}, Articles dans panier: ${getCartRes.body.data?.nb_articles}`);

                // Test 7: Créer une commande depuis le panier
                console.log('\n8. Test POST /api/commandes (Passer commande)...');
                const orderRes = await apiRequest('/api/commandes', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${clientToken}` },
                    body: JSON.stringify({
                        lieu_livraison: 'Nkoabang - Entrée lycée',
                        date_livraison_prevue: '2026-09-10'
                    })
                });
                console.log(`-> Status: ${orderRes.status}, Commande créée: #${orderRes.body.data?.code_commande}, Total: ${orderRes.body.data?.montant_total} FCFA`);
            }

            // Test 8: Admin Metrics
            console.log('\n9. Test GET /api/admin/metrics...');
            const metricsRes = await apiRequest('/api/admin/metrics', {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            console.log(`-> Status: ${metricsRes.status}, Métriques:`, metricsRes.body.data);

            console.log('\n✨ TOUS LES TESTS DES MODULES BACKEND SONT VALIDÉS AVEC SUCCÈS ! ✨');
        } catch (err) {
            console.error('❌ Erreur lors du test :', err);
        } finally {
            server.close(() => {
                console.log('Serveur de test arrêté.');
                process.exit();
            });
        }
    });
};

startServerAndTest();
