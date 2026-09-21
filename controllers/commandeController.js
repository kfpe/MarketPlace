const db = require('../config/db');

// Helper pour générer un code de commande unique (ex: CMD-260908-4821)
const generateOrderCode = () => {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CMD-${dateStr}-${rand}`;
};

// @desc    Créer une ou plusieurs commandes (depuis le panier ou commande directe)
// @route   POST /api/commandes
exports.createCommande = async (req, res, next) => {
    const client = await db.connect();
    try {
        const clientId = req.user.id;
        const {
            lieu_livraison,
            date_livraison_prevue,
            items // Optionnel : si fourni = commande directe, sinon = prend le panier
        } = req.body || {};

        if (!lieu_livraison) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez préciser le lieu / quartier exact de livraison.'
            });
        }

        await client.query('BEGIN');

        let orderItems = [];

        if (items && Array.isArray(items) && items.length > 0) {
            // Cas 1 : Commande directe avec liste de produits passée dans le corps
            for (const item of items) {
                const prodRes = await client.query(
                    `SELECT p.id, p.nom, p.prix, p.disponible, p.statut_stock, p.boutique_id, b.vendeur_id, b.nom_boutique
                     FROM produits p
                     JOIN boutiques b ON p.boutique_id = b.id
                     WHERE p.id = $1`,
                    [item.produit_id]
                );
                if (prodRes.rows.length === 0) {
                    throw new Error(`Produit #${item.produit_id} introuvable.`);
                }
                const prod = prodRes.rows[0];
                if (!prod.disponible || prod.statut_stock === 'RUPTURE') {
                    throw new Error(`Le produit "${prod.nom}" n'est pas disponible.`);
                }
                orderItems.push({
                    produit_id: prod.id,
                    nom: prod.nom,
                    quantite: parseInt(item.quantite) || 1,
                    prix_unitaire: parseFloat(prod.prix),
                    boutique_id: prod.boutique_id,
                    vendeur_id: prod.vendeur_id,
                    nom_boutique: prod.nom_boutique
                });
            }
        } else {
            // Cas 2 : Commande depuis le panier
            const cartRes = await client.query('SELECT id FROM paniers WHERE client_id = $1', [clientId]);
            if (cartRes.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Votre panier est vide.' });
            }
            const panierId = cartRes.rows[0].id;

            const cartItemsRes = await client.query(
                `SELECT l.id AS ligne_id, l.produit_id, l.quantite, l.prix_unitaire,
                        p.nom, p.disponible, p.statut_stock, p.boutique_id, b.vendeur_id, b.nom_boutique
                 FROM lignes_de_commande l
                 JOIN produits p ON l.produit_id = p.id
                 JOIN boutiques b ON p.boutique_id = b.id
                 WHERE l.panier_id = $1`,
                [panierId]
            );

            if (cartItemsRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Votre panier est vide.' });
            }

            for (const item of cartItemsRes.rows) {
                if (!item.disponible || item.statut_stock === 'RUPTURE') {
                    throw new Error(`Le produit "${item.nom}" est actuellement indisponible.`);
                }
                orderItems.push({
                    produit_id: item.produit_id,
                    nom: item.nom,
                    quantite: item.quantite,
                    prix_unitaire: parseFloat(item.prix_unitaire),
                    boutique_id: item.boutique_id,
                    vendeur_id: item.vendeur_id,
                    nom_boutique: item.nom_boutique
                });
            }

            // Vider le panier après commande
            await client.query('DELETE FROM lignes_de_commande WHERE panier_id = $1', [panierId]);
            await client.query('UPDATE paniers SET montant_total = 0.00, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [panierId]);
        }

        // Grouper les articles par commande
        // Calcul du total global
        const totalCommande = orderItems.reduce((sum, item) => sum + (item.quantite * item.prix_unitaire), 0);
        const codeCommande = generateOrderCode();

        // Insérer la commande dans 'commandes'
        const insertOrderQuery = `
            INSERT INTO commandes (
                code_commande, client_id, date_livraison_prevue,
                lieu_livraison, statut, montant_total
            )
            VALUES ($1, $2, $3, $4, 'EN_ATTENTE', $5)
            RETURNING *
        `;

        const orderResult = await client.query(insertOrderQuery, [
            codeCommande,
            clientId,
            date_livraison_prevue || null,
            lieu_livraison.trim(),
            totalCommande
        ]);

        const newCommande = orderResult.rows[0];

        // Insérer les lignes de commande dans 'lignes_de_commande' (avec commande_id, panier_id = null)
        for (const item of orderItems) {
            await client.query(
                `INSERT INTO lignes_de_commande (commande_id, panier_id, produit_id, quantite, prix_unitaire)
                 VALUES ($1, NULL, $2, $3, $4)`,
                [newCommande.id, item.produit_id, item.quantite, item.prix_unitaire]
            );
        }

        // Notifier le client
        await client.query(
            `INSERT INTO notifications (utilisateur_id, type, titre, message, lien_action)
             VALUES ($1, 'COMMANDE', 'Commande enregistrée', $2, $3)`,
            [
                clientId,
                `Votre commande #${codeCommande} d'un montant de ${totalCommande} FCFA a été enregistrée avec succès. Paiement à la livraison.`,
                `/commandes/${newCommande.id}`
            ]
        );

        // Notifier les vendeurs concernés
        const vendeursNotifies = new Set();
        for (const item of orderItems) {
            if (!vendeursNotifies.has(item.vendeur_id)) {
                vendeursNotifies.add(item.vendeur_id);
                await client.query(
                    `INSERT INTO notifications (utilisateur_id, type, titre, message, lien_action)
                     VALUES ($1, 'COMMANDE', 'Nouvelle commande reçue !', $2, $3)`,
                    [
                        item.vendeur_id,
                        `Vous avez reçu une nouvelle commande (#${codeCommande}) pour la boutique "${item.nom_boutique}". Lieu : ${lieu_livraison}.`,
                        `/vendeur/commandes/${newCommande.id}`
                    ]
                );
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Commande validée avec succès.',
            data: {
                ...newCommande,
                articles: orderItems
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur createCommande :', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Erreur lors de la création de la commande.'
        });
    } finally {
        client.release();
    }
};

// @desc    Obtenir les commandes du client connecté
// @route   GET /api/commandes/my-orders
exports.getMyOrders = async (req, res, next) => {
    try {
        const clientId = req.user.id;

        const ordersQuery = `
            SELECT c.*,
                   COUNT(l.id)::int AS nb_articles,
                   json_agg(
                       json_build_object(
                           'ligne_id', l.id,
                           'produit_id', p.id,
                           'nom_produit', p.nom,
                           'photos', p.photos,
                           'quantite', l.quantite,
                           'prix_unitaire', l.prix_unitaire,
                           'nom_boutique', b.nom_boutique,
                           'contact_whatsapp', b.contact_whatsapp
                       )
                   ) AS articles
            FROM commandes c
            LEFT JOIN lignes_de_commande l ON c.id = l.commande_id
            LEFT JOIN produits p ON l.produit_id = p.id
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            WHERE c.client_id = $1
            GROUP BY c.id
            ORDER BY c.date_commande DESC
        `;
        const result = await db.query(ordersQuery, [clientId]);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getMyOrders :', error);
        next(error);
    }
};

// @desc    Obtenir les commandes reçues par le vendeur connecté
// @route   GET /api/commandes/vendor-orders
exports.getVendorOrders = async (req, res, next) => {
    try {
        const vendeurId = req.user.id;

        // Trouver la boutique du vendeur
        const boutiqueRes = await db.query('SELECT id FROM boutiques WHERE vendeur_id = $1', [vendeurId]);
        if (boutiqueRes.rows.length === 0) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const boutiqueId = boutiqueRes.rows[0].id;

        const query = `
            SELECT 
                c.id AS commande_id,
                c.code_commande,
                c.date_commande,
                c.date_livraison_prevue,
                c.lieu_livraison,
                c.statut,
                c.montant_total,
                u.nom AS client_nom,
                u.telephone AS client_telephone,
                u.email AS client_email,
                json_agg(
                    json_build_object(
                        'produit_id', p.id,
                        'nom_produit', p.nom,
                        'photos', p.photos,
                        'quantite', l.quantite,
                        'prix_unitaire', l.prix_unitaire
                    )
                ) AS articles
            FROM commandes c
            JOIN lignes_de_commande l ON c.id = l.commande_id
            JOIN produits p ON l.produit_id = p.id
            JOIN utilisateurs u ON c.client_id = u.id
            WHERE p.boutique_id = $1
            GROUP BY c.id, u.id
            ORDER BY c.date_commande DESC
        `;

        const result = await db.query(query, [boutiqueId]);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getVendorOrders :', error);
        next(error);
    }
};

// @desc    Détails d'une commande
// @route   GET /api/commandes/:id
exports.getOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const orderRes = await db.query(
            `SELECT c.*, u.nom AS client_nom, u.telephone AS client_telephone, u.email AS client_email
             FROM commandes c
             JOIN utilisateurs u ON c.client_id = u.id
             WHERE c.id = $1`,
            [id]
        );

        if (orderRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }

        const commande = orderRes.rows[0];

        // Récupérer les articles
        const itemsRes = await db.query(
            `SELECT l.*, p.nom AS produit_nom, p.photos AS produit_photos,
                    b.id AS boutique_id, b.nom_boutique, b.contact_whatsapp, b.vendeur_id
             FROM lignes_de_commande l
             JOIN produits p ON l.produit_id = p.id
             JOIN boutiques b ON p.boutique_id = b.id
             WHERE l.commande_id = $1`,
            [id]
        );

        // Vérification des droits d'accès
        const isClient = commande.client_id === userId;
        const isVendor = itemsRes.rows.some(i => i.vendeur_id === userId);
        const isAdmin = userRole === 'ADMIN';

        if (!isClient && !isVendor && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Accès refusé à cette commande.' });
        }

        res.status(200).json({
            success: true,
            data: {
                ...commande,
                articles: itemsRes.rows
            }
        });
    } catch (error) {
        console.error('Erreur getOrderById :', error);
        next(error);
    }
};

// @desc    Mettre à jour le statut d'une commande (Vendeur ou Admin)
// @route   PATCH /api/commandes/:id/status
exports.updateOrderStatus = async (req, res, next) => {
    const client = await db.connect();
    try {
        const { id } = req.params;
        const { statut } = req.body || {};
        const userId = req.user.id;
        const userRole = req.user.role;

        const validStatuses = ['EN_ATTENTE', 'VALIDEE', 'EN_COURS_DE_LIVRAISON', 'LIVREE', 'ANNULEE'];
        if (!statut || !validStatuses.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Choisissez parmi : ${validStatuses.join(', ')}`
            });
        }

        const orderRes = await client.query('SELECT * FROM commandes WHERE id = $1', [id]);
        if (orderRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }
        const commande = orderRes.rows[0];

        // Vérifier si l'utilisateur est le vendeur lié aux articles ou l'admin
        const itemsRes = await client.query(
            `SELECT p.boutique_id, b.vendeur_id
             FROM lignes_de_commande l
             JOIN produits p ON l.produit_id = p.id
             JOIN boutiques b ON p.boutique_id = b.id
             WHERE l.commande_id = $1`,
            [id]
        );

        const isVendor = itemsRes.rows.some(i => i.vendeur_id === userId);
        if (!isVendor && userRole !== 'ADMIN' && commande.client_id !== userId) {
            return res.status(403).json({ success: false, message: 'Non autorisé à modifier ce statut.' });
        }

        // Les clients ne peuvent que annuler si la commande est EN_ATTENTE
        if (commande.client_id === userId && userRole !== 'ADMIN' && !isVendor) {
            if (statut !== 'ANNULEE' || commande.statut !== 'EN_ATTENTE') {
                return res.status(400).json({
                    success: false,
                    message: 'Vous ne pouvez qu\'annuler une commande en attente.'
                });
            }
        }

        await client.query('BEGIN');

        const updateRes = await client.query(
            `UPDATE commandes 
             SET statut = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 
             RETURNING *`,
            [statut, id]
        );

        const updatedCommande = updateRes.rows[0];

        // Si la commande passe à LIVREE, incrémenter le total des recettes de la boutique
        if (statut === 'LIVREE' && commande.statut !== 'LIVREE') {
            for (const item of itemsRes.rows) {
                await client.query(
                    `UPDATE statistiques_vendeurs 
                     SET total_recettes_app = total_recettes_app + $1 
                     WHERE boutique_id = $2`,
                    [commande.montant_total, item.boutique_id]
                );
            }
        }

        // Notification envoyée au client
        await client.query(
            `INSERT INTO notifications (utilisateur_id, type, titre, message, lien_action)
             VALUES ($1, 'COMMANDE', 'Mise à jour de votre commande', $2, $3)`,
            [
                commande.client_id,
                `Le statut de votre commande #${commande.code_commande} est désormais : ${statut}.`,
                `/commandes/${commande.id}`
            ]
        );

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `Statut de la commande mis à jour (${statut}).`,
            data: updatedCommande
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur updateOrderStatus :', error);
        next(error);
    } finally {
        client.release();
    }
};
