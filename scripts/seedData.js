const db = require('../config/db');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
    const client = await db.connect();
    try {
        console.log('🌱 Nettoyage et initialisation de la base de données de test...');
        await client.query('BEGIN');

        // Nettoyer les tables dans l'ordre pour éviter les conflits FK
        await client.query('DELETE FROM avis');
        await client.query('DELETE FROM messages');
        await client.query('DELETE FROM discussions');
        await client.query('DELETE FROM notifications');
        await client.query('DELETE FROM lignes_de_commande');
        await client.query('DELETE FROM commandes');
        await client.query('DELETE FROM paniers');
        await client.query('DELETE FROM produits');
        await client.query('DELETE FROM statistiques_vendeurs');
        await client.query('DELETE FROM boutiques');
        await client.query('DELETE FROM vendeurs');
        await client.query('DELETE FROM clients');
        await client.query('DELETE FROM utilisateurs');
        await client.query('DELETE FROM categories');

        // Reset des séquences
        const tables = ['categories', 'utilisateurs', 'boutiques', 'produits', 'paniers', 'commandes', 'lignes_de_commande', 'discussions', 'messages', 'notifications', 'avis'];
        for (const t of tables) {
            try {
                await client.query(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`);
            } catch (e) { /* sequence might have different name or not exist */ }
        }

        console.log('✅ Tables réinitialisées.');

        // ==========================================
        // 1. CATÉGORIES
        // ==========================================
        const categoriesData = [
            { nom: 'Alimentation & Boissons', icone: 'fast-food' },
            { nom: 'Mode & Chaussures', icone: 'shirt' },
            { nom: 'Électronique & Téléphones', icone: 'phone-portrait' },
            { nom: 'Beauté & Bien-être', icone: 'sparkles' },
            { nom: 'Maison & Décoration', icone: 'home' },
            { nom: 'Services & Réparations', icone: 'construct' }
        ];

        const catMap = {};
        for (const cat of categoriesData) {
            const res = await client.query(
                `INSERT INTO categories (nom, icone) VALUES ($1, $2) RETURNING id, nom`,
                [cat.nom, cat.icone]
            );
            catMap[cat.nom] = res.rows[0].id;
        }
        console.log('✅ 6 Catégories créées.');

        // Hash générique
        const defaultHash = await bcrypt.hash('123456', 10);
        const adminHash = await bcrypt.hash('admin1234', 10);

        // ==========================================
        // 2. ADMINISTRATEUR
        // ==========================================
        const adminRes = await client.query(
            `INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe, role)
             VALUES ('Super Administrateur', 'admin@projetboutik.com', '+237690000001', $1, 'ADMIN')
             RETURNING id`,
            [adminHash]
        );
        const adminId = adminRes.rows[0].id;

        // ==========================================
        // 3. VENDEURS & BOUTIQUES
        // ==========================================
        const boutiquesData = [
            {
                user: { nom: 'Maman Fofo', email: 'fofo@projetboutik.com', telephone: '+237671110001' },
                boutique: {
                    nom: 'Maman Fofo • Alimentation',
                    logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300',
                    desc: 'Fruits frais, vivres frais, légumes bio, régimes de plantains et épices traditionnelles du terroir.',
                    quartier: 'Nkoabang',
                    repere: '10e arrêt face à la pharmacie',
                    lat: 3.8741, lng: 11.5823,
                    whatsapp: '+237671110001',
                    horaire: '07h00 - 19h30',
                },
                stats: { vues_b: 142, vues_p: 380, whatsapp: 45, appels: 12, recettes: 245000.00 },
                produits: [
                    {
                        nom: 'Régime de Plantain Gros Doigts',
                        cat: 'Alimentation & Boissons',
                        prix: 5500,
                        photos: ['https://images.unsplash.com/photo-1528825871115-3581a5387919?w=500'],
                        desc: 'Plantain mûr ou vert de très bonne qualité, idéal pour tapé ou friture.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Bidon d\'Huile de Palme Pure 5L',
                        cat: 'Alimentation & Boissons',
                        prix: 7000,
                        photos: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500'],
                        desc: 'Huile rouge naturelle non mélangée provenant directement d\'Éséka.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Sac de Riz Parfumé 25kg',
                        cat: 'Alimentation & Boissons',
                        prix: 18500,
                        photos: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500'],
                        desc: 'Riz blanc grain long parfumé de qualité supérieure pour toute la famille.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Panier d\'Épices Traditionnelles du Pays',
                        cat: 'Alimentation & Boissons',
                        prix: 3500,
                        photos: ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500'],
                        desc: 'Assortiment de rondelles, pèbè, esese, djansang pour sauces et bouillons.',
                        stock: 'EN_STOCK'
                    }
                ]
            },
            {
                user: { nom: 'Alain Electro', email: 'electro@projetboutik.com', telephone: '+237672220002' },
                boutique: {
                    nom: 'Electro Bastos • Électronique',
                    logo: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=300',
                    desc: 'Smartphones originaux, accessoires certifiés, chargeurs rapides, montres connectées et matériel informatique.',
                    quartier: 'Bastos',
                    repere: 'Carrefour Bastos à côté de la boulangerie',
                    lat: 3.8932, lng: 11.5167,
                    whatsapp: '+237672220002',
                    horaire: '08h30 - 21h00',
                },
                stats: { vues_b: 285, vues_p: 720, whatsapp: 89, appels: 28, recettes: 890000.00 },
                produits: [
                    {
                        nom: 'Samsung Galaxy A54 5G 128Go',
                        cat: 'Électronique & Téléphones',
                        prix: 175000,
                        photos: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500'],
                        desc: 'Smartphone neuf scellé avec garantie 1 an, appareil photo 50MP et écran Super AMOLED 120Hz.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Écouteurs Sans Fil Pro Bass TWS',
                        cat: 'Électronique & Téléphones',
                        prix: 15000,
                        photos: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500'],
                        desc: 'Autonomie de 24h, réduction de bruit passive et son stéréo immersif.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Chargeur Ultra Rapide GaN 65W Type-C',
                        cat: 'Électronique & Téléphones',
                        prix: 12000,
                        photos: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500'],
                        desc: 'Charge rapide pour ordinateurs portables, iPhone et téléphones Android.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Smartwatch Fitness Sport Waterproof',
                        cat: 'Électronique & Téléphones',
                        prix: 22000,
                        photos: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
                        desc: 'Suivi du rythme cardiaque, notifications WhatsApp, podomètre et étanche IP68.',
                        stock: 'EN_STOCK'
                    }
                ]
            },
            {
                user: { nom: 'Ali Style', email: 'style@projetboutik.com', telephone: '+237673330003' },
                boutique: {
                    nom: 'Style237 • Vêtements & Mode',
                    logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300',
                    desc: 'Boutique de prêt-à-porter homme et femme, sneakers tendance, chemises stylées et jeans de marque.',
                    quartier: 'Mokolo',
                    repere: 'En face du marché Mokolo 2e entrée',
                    lat: 3.8712, lng: 11.5034,
                    whatsapp: '+237673330003',
                    horaire: '08h00 - 19h00',
                },
                stats: { vues_b: 310, vues_p: 850, whatsapp: 112, appels: 34, recettes: 450000.00 },
                produits: [
                    {
                        nom: 'Nike Air Max Pro Blanc & Gris',
                        cat: 'Mode & Chaussures',
                        prix: 35000,
                        photos: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
                        desc: 'Sneakers stylées et confortables disponibles du 40 au 45, semelle coussinée.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Chaussures de Sport Noires Respirantes',
                        cat: 'Mode & Chaussures',
                        prix: 22500,
                        photos: ['https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500'],
                        desc: 'Idéales pour le running et le quotidien, ultra légères et aérées.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Chemise Slim Fit 100% Coton Blanche',
                        cat: 'Mode & Chaussures',
                        prix: 12000,
                        photos: ['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500'],
                        desc: 'Chemise habillée coupe cintrée idéale pour travail et cérémonies.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Jean Denim Brut Coupe Droite',
                        cat: 'Mode & Chaussures',
                        prix: 14000,
                        photos: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500'],
                        desc: 'Tissu denim robuste résistant au lavage, tailles du 30 au 38.',
                        stock: 'EN_STOCK'
                    }
                ]
            },
            {
                user: { nom: 'Carine Beauté', email: 'glamour@projetboutik.com', telephone: '+237674440004' },
                boutique: {
                    nom: 'Glamour Yaoundé • Beauté & Parfums',
                    logo: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300',
                    desc: 'Cosmétiques de luxe, parfums de créateurs, soins capillaires et corporels bio pour femmes et hommes.',
                    quartier: 'Omnisports',
                    repere: 'Face au stade Omnisports entrée présidentielle',
                    lat: 3.8821, lng: 11.5398,
                    whatsapp: '+237674440004',
                    horaire: '09h00 - 20h00',
                },
                stats: { vues_b: 195, vues_p: 480, whatsapp: 62, appels: 15, recettes: 320000.00 },
                produits: [
                    {
                        nom: 'Eau de Parfum Boisée Intense 100ml',
                        cat: 'Beauté & Bien-être',
                        prix: 28000,
                        photos: ['https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500'],
                        desc: 'Fragrance longue durée aux notes d\'ambre, bois de cèdre et vanille.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Kit Soin Visage Éclat à l\'Aloe Vera',
                        cat: 'Beauté & Bien-être',
                        prix: 16000,
                        photos: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500'],
                        desc: 'Nettoyant moussant, sérum hydratant et crème anti-imperfections.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Huile Végétale d\'Argan Pure 100% Bio',
                        cat: 'Beauté & Bien-être',
                        prix: 8500,
                        photos: ['https://images.unsplash.com/photo-1608248597359-3e3e230894be?w=500'],
                        desc: 'Idéale pour fortifier les cheveux et nourrir la peau en profondeur.',
                        stock: 'EN_STOCK'
                    }
                ]
            },
            {
                user: { nom: 'Samuel Confort', email: 'maison@projetboutik.com', telephone: '+237675550005' },
                boutique: {
                    nom: 'Maison Confort • Électroménager & Déco',
                    logo: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300',
                    desc: 'Petits et gros appareils électroménagers, draps haut de gamme, luminaires et accessoires de maison.',
                    quartier: 'Biyem-Assi',
                    repere: 'Rond-point Express Biyem-Assi',
                    lat: 3.8423, lng: 11.4876,
                    whatsapp: '+237675550005',
                    horaire: '08h00 - 19h30',
                },
                stats: { vues_b: 160, vues_p: 390, whatsapp: 38, appels: 9, recettes: 180000.00 },
                produits: [
                    {
                        nom: 'Mixeur Blender Multifonction 2 en 1',
                        cat: 'Maison & Décoration',
                        prix: 19500,
                        photos: ['https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500'],
                        desc: 'Lames en acier inoxydable et bol incassable 1.5L, idéal pour jus et pâtes.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Ensemble Draps de Lit 3 Pièces 100% Coton',
                        cat: 'Maison & Décoration',
                        prix: 14000,
                        photos: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500'],
                        desc: 'Drap housse + drap plat + 2 taies d\'oreillers doux et confortables.',
                        stock: 'EN_STOCK'
                    },
                    {
                        nom: 'Lampe de Chevet Design Tactile 3 Niveaux',
                        cat: 'Maison & Décoration',
                        prix: 9500,
                        photos: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500'],
                        desc: 'Lumière d\'ambiance blanc chaud et ports USB de charge intégrés.',
                        stock: 'EN_STOCK'
                    }
                ]
            }
        ];

        const insertedBoutiques = [];
        const insertedProduits = [];

        for (const item of boutiquesData) {
            // Créer le compte utilisateur vendeur
            const uRes = await client.query(
                `INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe, role)
                 VALUES ($1, $2, $3, $4, 'VENDEUR')
                 RETURNING id`,
                [item.user.nom, item.user.email, item.user.telephone, defaultHash]
            );
            const vId = uRes.rows[0].id;

            // Abonnement vendeur
            const dateFin = new Date();
            dateFin.setMonth(dateFin.getMonth() + 2);
            await client.query(
                `INSERT INTO vendeurs (utilisateur_id, est_abonne, date_fin_abonnement)
                 VALUES ($1, true, $2)`,
                [vId, dateFin]
            );

            // Boutique
            const bRes = await client.query(
                `INSERT INTO boutiques (
                    vendeur_id, nom_boutique, logo, description,
                    quartier, point_repere, latitude, longitude,
                    contact_whatsapp, statut, horaire_ouverture, est_ouvert
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'VERIFIEE', $10, true)
                RETURNING *`,
                [
                    vId,
                    item.boutique.nom,
                    item.boutique.logo,
                    item.boutique.desc,
                    item.boutique.quartier,
                    item.boutique.repere,
                    item.boutique.lat,
                    item.boutique.lng,
                    item.boutique.whatsapp,
                    item.boutique.horaire
                ]
            );
            const boutique = bRes.rows[0];
            insertedBoutiques.push(boutique);

            // Stats (Upsert au cas où un trigger existe)
            await client.query(
                `INSERT INTO statistiques_vendeurs (boutique_id, nb_vues_boutique, nb_vues_produits, nb_clics_whatsapp, nb_appels, total_recettes_app)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (boutique_id) 
                 DO UPDATE SET 
                    nb_vues_boutique = EXCLUDED.nb_vues_boutique,
                    nb_vues_produits = EXCLUDED.nb_vues_produits,
                    nb_clics_whatsapp = EXCLUDED.nb_clics_whatsapp,
                    nb_appels = EXCLUDED.nb_appels,
                    total_recettes_app = EXCLUDED.total_recettes_app`,
                [boutique.id, item.stats.vues_b, item.stats.vues_p, item.stats.whatsapp, item.stats.appels, item.stats.recettes]
            );

            // Produits
            for (const p of item.produits) {
                const cId = catMap[p.cat] || Object.values(catMap)[0];
                const pRes = await client.query(
                    `INSERT INTO produits (boutique_id, categorie_id, nom, description, prix, photos, disponible, statut_stock)
                     VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                     RETURNING *`,
                    [boutique.id, cId, p.nom, p.desc, p.prix, p.photos, p.stock]
                );
                insertedProduits.push(pRes.rows[0]);
            }
        }
        console.log(`✅ 5 Boutiques et ${insertedProduits.length} Produits créés.`);

        // ==========================================
        // 4. CLIENTS DE DÉMONSTRATION
        // ==========================================
        const clientsData = [
            { nom: 'Alice Cliente', email: 'client@projetboutik.com', tel: '+237699000001', adresse: 'Nkoabang — Carrefour CEF' },
            { nom: 'Paul Mbida', email: 'paul@projetboutik.com', tel: '+237699000002', adresse: 'Bastos — Rue des Ambassades' },
            { nom: 'Sandra Ngo', email: 'sandra@projetboutik.com', tel: '+237699000003', adresse: 'Biyem-Assi — Rond-point Express' },
        ];

        const insertedClients = [];
        for (const c of clientsData) {
            const uRes = await client.query(
                `INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe, role)
                 VALUES ($1, $2, $3, $4, 'CLIENT')
                 RETURNING id, nom, email`,
                [c.nom, c.email, c.tel, defaultHash]
            );
            const uId = uRes.rows[0].id;
            insertedClients.push({ ...uRes.rows[0], tel: c.tel });

            await client.query(
                `INSERT INTO clients (utilisateur_id, adresse_residence, latitude, longitude)
                 VALUES ($1, $2, 3.8750, 11.5830)`,
                [uId, c.adresse]
            );

            // Panier
            await client.query(
                `INSERT INTO paniers (client_id, montant_total) 
                 VALUES ($1, 0.00)
                 ON CONFLICT (client_id) DO NOTHING`,
                [uId]
            );
        }
        console.log('✅ 3 Clients de test créés.');

        // ==========================================
        // 5. AVIS CLIENTS (NOTATIONS)
        // ==========================================
        const avisData = [
            { boutiqueIdx: 0, clientIdx: 0, note: 5, comm: 'Produits super frais, livraison rapide en 30 min à Nkoabang !' },
            { boutiqueIdx: 0, clientIdx: 1, note: 5, comm: 'Le plantain était de très bonne qualité, merci Maman Fofo.' },
            { boutiqueIdx: 1, clientIdx: 1, note: 5, comm: 'Téléphone authentique scellé dans sa boîte avec garantie. Très pro.' },
            { boutiqueIdx: 1, clientIdx: 2, note: 4, comm: 'Écouteurs au top, bon son et livraison soignée.' },
            { boutiqueIdx: 2, clientIdx: 0, note: 5, comm: 'Baskets Nike magnifiques, exactement comme sur la photo !' },
            { boutiqueIdx: 2, clientIdx: 2, note: 5, comm: 'Vendeur très courtois et réponse WhatsApp ultra rapide.' },
            { boutiqueIdx: 3, clientIdx: 2, note: 5, comm: 'Parfum de grande qualité, odeur envoûtante toute la journée.' },
            { boutiqueIdx: 4, clientIdx: 0, note: 4, comm: 'Draps de lit très doux, bon rapport qualité prix.' }
        ];

        for (const a of avisData) {
            const bId = insertedBoutiques[a.boutiqueIdx].id;
            const cId = insertedClients[a.clientIdx].id;
            await client.query(
                `INSERT INTO avis (client_id, boutique_id, note, commentaire)
                 VALUES ($1, $2, $3, $4)`,
                [cId, bId, a.note, a.comm]
            );
        }
        console.log('✅ 8 Avis & Notes clients enregistrés.');

        // ==========================================
        // 6. COMMANDES EN COURS ET LIVRÉES
        // ==========================================
        const aliceId = insertedClients[0].id;
        const paulId = insertedClients[1].id;

        // Commande 1 : Livrée pour Alice
        const cmd1Res = await client.query(
            `INSERT INTO commandes (code_commande, client_id, date_commande, date_livraison_prevue, lieu_livraison, statut, montant_total)
             VALUES ('CMD-260908-1011', $1, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_DATE - 2, 'Nkoabang — 10e arrêt face pharmacie', 'LIVREE', 42000.00)
             RETURNING id`,
            [aliceId]
        );
        const cmd1Id = cmd1Res.rows[0].id;
        // Articles de cmd 1
        await client.query(
            `INSERT INTO lignes_de_commande (commande_id, produit_id, quantite, prix_unitaire)
             VALUES ($1, $2, 1, 35000.00), ($1, $3, 2, 3500.00)`,
            [cmd1Id, insertedProduits[8].id, insertedProduits[3].id]
        );

        // Commande 2 : Validée pour Alice
        const cmd2Res = await client.query(
            `INSERT INTO commandes (code_commande, client_id, date_commande, date_livraison_prevue, lieu_livraison, statut, montant_total)
             VALUES ('CMD-260908-1024', $1, CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_DATE, 'Nkoabang — Carrefour CEF', 'VALIDEE', 22500.00)
             RETURNING id`,
            [aliceId]
        );
        const cmd2Id = cmd2Res.rows[0].id;
        await client.query(
            `INSERT INTO lignes_de_commande (commande_id, produit_id, quantite, prix_unitaire)
             VALUES ($1, $2, 1, 22500.00)`,
            [cmd2Id, insertedProduits[9].id]
        );

        // Commande 3 : En attente pour Paul (Electro Bastos)
        const cmd3Res = await client.query(
            `INSERT INTO commandes (code_commande, client_id, date_commande, date_livraison_prevue, lieu_livraison, statut, montant_total)
             VALUES ('CMD-260908-1033', $1, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_DATE, 'Bastos — Face ambassade de France', 'EN_ATTENTE', 27000.00)
             RETURNING id`,
            [paulId]
        );
        const cmd3Id = cmd3Res.rows[0].id;
        await client.query(
            `INSERT INTO lignes_de_commande (commande_id, produit_id, quantite, prix_unitaire)
             VALUES ($1, $2, 1, 15000.00), ($1, $3, 1, 12000.00)`,
            [cmd3Id, insertedProduits[5].id, insertedProduits[6].id]
        );

        console.log('✅ 3 Commandes avec lignes d\'articles injectées.');

        // ==========================================
        // 7. DISCUSSIONS & MESSAGES DE TCHAT
        // ==========================================
        const vendeurFofoId = insertedBoutiques[0].vendeur_id;
        const vendeurStyleId = insertedBoutiques[2].vendeur_id;

        // Discussion 1 : Alice & Maman Fofo
        const disc1Res = await client.query(
            `INSERT INTO discussions (client_id, vendeur_id) VALUES ($1, $2) RETURNING id`,
            [aliceId, vendeurFofoId]
        );
        const disc1Id = disc1Res.rows[0].id;

        // Messages disc 1
        const msgsDisc1 = [
            { exp: aliceId, text: "Bonjour Maman Fofo, avez-vous des régimes de plantain bien mûrs aujourd'hui ?", read: true, interval: '1 hour' },
            { exp: vendeurFofoId, text: "Oui ma fille, de très gros régimes viennent d'arriver de la plantation !", read: true, interval: '45 minutes' },
            { exp: aliceId, text: "Super, je passe commande de suite sur l'application !", read: true, interval: '30 minutes' }
        ];

        for (const m of msgsDisc1) {
            await client.query(
                `INSERT INTO messages (discussion_id, expediteur_id, contenu, horodatage, est_lu)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP - ($4)::INTERVAL, $5)`,
                [disc1Id, m.exp, m.text, m.interval, m.read]
            );
        }

        // Discussion 2 : Alice & Style237
        const disc2Res = await client.query(
            `INSERT INTO discussions (client_id, vendeur_id) VALUES ($1, $2) RETURNING id`,
            [aliceId, vendeurStyleId]
        );
        const disc2Id = disc2Res.rows[0].id;

        const msgsDisc2 = [
            { exp: aliceId, text: "Bonjour, la paire de Nike Air Max est-elle disponible en pointure 42 ?", read: true, interval: '20 minutes' },
            { exp: vendeurStyleId, text: "Bonjour Alice ! Oui, nous avons la pointure 42 en stock. Livraison possible dans l'heure.", read: false, interval: '10 minutes' }
        ];

        for (const m of msgsDisc2) {
            await client.query(
                `INSERT INTO messages (discussion_id, expediteur_id, contenu, horodatage, est_lu)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP - ($4)::INTERVAL, $5)`,
                [disc2Id, m.exp, m.text, m.interval, m.read]
            );
        }

        console.log('✅ Discussions et messages de tchat créés.');

        // ==========================================
        // 8. NOTIFICATIONS IN-APP
        // ==========================================
        const notifs = [
            { uId: aliceId, type: 'COMMANDE', title: 'Commande confirmée', msg: 'Votre commande #CMD-260908-1024 a été validée par la boutique.' },
            { uId: aliceId, type: 'MESSAGE', title: 'Nouveau message', msg: 'Style237 vous a répondu concernant la disponibilité de la pointure 42.' },
            { uId: vendeurFofoId, type: 'COMMANDE', title: 'Nouvelle commande reçue', msg: 'Vous avez reçu une commande #CMD-260908-1011 de Alice Cliente.' },
            { uId: vendeurStyleId, type: 'BOUTIQUE', title: 'Boutique vérifiée ✓', msg: 'Félicitations ! Votre boutique "Style237" a été vérifiée par l\'administration.' }
        ];

        for (const n of notifs) {
            await client.query(
                `INSERT INTO notifications (utilisateur_id, type, titre, message, est_lue)
                 VALUES ($1, $2, $3, $4, false)`,
                [n.uId, n.type, n.title, n.msg]
            );
        }
        console.log('✅ Notifications in-app générées.');

        await client.query('COMMIT');
        console.log('\n🎉 BASE DE DONNÉES ENRICHIE AVEC SUCCÈS ! SYSTÈME COMPLET OPÉRATIONNEL.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur seedDatabase :', error);
    } finally {
        client.release();
        process.exit();
    }
};

seedDatabase();
