const db = require('../config/db');

// Helper pour récupérer ou créer le panier d'un client
const getOrCreateCart = async (clientDb, clientId) => {
    let cartRes = await clientDb.query('SELECT * FROM paniers WHERE client_id = $1', [clientId]);
    if (cartRes.rows.length === 0) {
        cartRes = await clientDb.query(
            'INSERT INTO paniers (client_id, montant_total) VALUES ($1, 0.00) RETURNING *',
            [clientId]
        );
    }
    return cartRes.rows[0];
};

// Helper pour recalculer le montant total du panier
const recalculateCartTotal = async (clientDb, panierId) => {
    const sumRes = await clientDb.query(
        'SELECT COALESCE(SUM(quantite * prix_unitaire), 0) AS total FROM lignes_de_commande WHERE panier_id = $1',
        [panierId]
    );
    const total = parseFloat(sumRes.rows[0].total);
    await clientDb.query(
        'UPDATE paniers SET montant_total = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [total, panierId]
    );
    return total;
};

// @desc    Obtenir le panier du client connecté
// @route   GET /api/cart
exports.getCart = async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const panier = await getOrCreateCart(db, clientId);

        // Récupérer les items du panier avec les détails des produits et des boutiques
        const itemsQuery = `
            SELECT 
                l.id AS ligne_id,
                l.quantite,
                l.prix_unitaire,
                (l.quantite * l.prix_unitaire) AS sous_total,
                p.id AS produit_id,
                p.nom AS produit_nom,
                p.photos AS produit_photos,
                p.disponible AS produit_disponible,
                p.statut_stock AS produit_stock,
                b.id AS boutique_id,
                b.nom_boutique,
                b.contact_whatsapp,
                b.quartier AS boutique_quartier
            FROM lignes_de_commande l
            JOIN produits p ON l.produit_id = p.id
            JOIN boutiques b ON p.boutique_id = b.id
            WHERE l.panier_id = $1
            ORDER BY l.id ASC
        `;
        const itemsRes = await db.query(itemsQuery, [panier.id]);

        // Recalculer le total
        const total = await recalculateCartTotal(db, panier.id);

        res.status(200).json({
            success: true,
            data: {
                panier_id: panier.id,
                montant_total: total,
                nb_articles: itemsRes.rows.reduce((sum, item) => sum + item.quantite, 0),
                items: itemsRes.rows
            }
        });
    } catch (error) {
        console.error('Erreur getCart :', error);
        next(error);
    }
};

// @desc    Ajouter un produit au panier
// @route   POST /api/cart/items
exports.addItemToCart = async (req, res, next) => {
    const client = await db.connect();
    try {
        const clientId = req.user.id;
        const { produit_id, quantite = 1 } = req.body || {};

        if (!produit_id || parseInt(quantite) < 1) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir un produit_id valide et une quantité positive.'
            });
        }

        // Vérifier l'existence et le prix du produit
        const prodRes = await client.query(
            'SELECT id, nom, prix, disponible, statut_stock FROM produits WHERE id = $1',
            [produit_id]
        );

        if (prodRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Produit introuvable.' });
        }

        const product = prodRes.rows[0];
        if (!product.disponible || product.statut_stock === 'RUPTURE') {
            return res.status(400).json({
                success: false,
                message: `Le produit "${product.nom}" est actuellement en rupture de stock.`
            });
        }

        await client.query('BEGIN');

        const panier = await getOrCreateCart(client, clientId);

        // Vérifier si le produit est déjà dans le panier
        const existingItem = await client.query(
            'SELECT id, quantite FROM lignes_de_commande WHERE panier_id = $1 AND produit_id = $2',
            [panier.id, produit_id]
        );

        let ligneId;
        if (existingItem.rows.length > 0) {
            // Mettre à jour la quantité
            const newQty = existingItem.rows[0].quantite + parseInt(quantite);
            const updateRes = await client.query(
                'UPDATE lignes_de_commande SET quantite = $1, prix_unitaire = $2 WHERE id = $3 RETURNING id',
                [newQty, product.prix, existingItem.rows[0].id]
            );
            ligneId = updateRes.rows[0].id;
        } else {
            // Insérer une nouvelle ligne
            const insertRes = await client.query(
                `INSERT INTO lignes_de_commande (panier_id, produit_id, quantite, prix_unitaire)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [panier.id, produit_id, parseInt(quantite), product.prix]
            );
            ligneId = insertRes.rows[0].id;
        }

        const total = await recalculateCartTotal(client, panier.id);

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Produit ajouté au panier avec succès.',
            data: {
                ligne_id: ligneId,
                panier_id: panier.id,
                montant_total: total
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur addItemToCart :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Modifier la quantité d'un article dans le panier
// @route   PUT /api/cart/items/:id
exports.updateCartItem = async (req, res, next) => {
    const client = await db.connect();
    try {
        const { id } = req.params; // ID de la ligne de commande
        const clientId = req.user.id;
        const { quantite } = req.body || {};

        const panier = await getOrCreateCart(client, clientId);

        const itemRes = await client.query(
            'SELECT * FROM lignes_de_commande WHERE id = $1 AND panier_id = $2',
            [id, panier.id]
        );

        if (itemRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Article du panier introuvable.' });
        }

        await client.query('BEGIN');

        if (parseInt(quantite) <= 0) {
            // Supprimer la ligne si quantité <= 0
            await client.query('DELETE FROM lignes_de_commande WHERE id = $1', [id]);
        } else {
            await client.query(
                'UPDATE lignes_de_commande SET quantite = $1 WHERE id = $2',
                [parseInt(quantite), id]
            );
        }

        const total = await recalculateCartTotal(client, panier.id);

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Panier mis à jour.',
            data: {
                panier_id: panier.id,
                montant_total: total
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur updateCartItem :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Supprimer un article du panier
// @route   DELETE /api/cart/items/:id
exports.removeCartItem = async (req, res, next) => {
    const client = await db.connect();
    try {
        const { id } = req.params;
        const clientId = req.user.id;

        const panier = await getOrCreateCart(client, clientId);

        await client.query('BEGIN');

        const deleteRes = await client.query(
            'DELETE FROM lignes_de_commande WHERE id = $1 AND panier_id = $2 RETURNING id',
            [id, panier.id]
        );

        if (deleteRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Article introuvable dans votre panier.' });
        }

        const total = await recalculateCartTotal(client, panier.id);

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Article retiré du panier.',
            data: {
                panier_id: panier.id,
                montant_total: total
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur removeCartItem :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Vider entièrement le panier
// @route   DELETE /api/cart
exports.clearCart = async (req, res, next) => {
    const client = await db.connect();
    try {
        const clientId = req.user.id;
        const panier = await getOrCreateCart(client, clientId);

        await client.query('BEGIN');
        await client.query('DELETE FROM lignes_de_commande WHERE panier_id = $1', [panier.id]);
        await client.query('UPDATE paniers SET montant_total = 0.00, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [panier.id]);
        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Panier vidé avec succès.'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur clearCart :', error);
        next(error);
    } finally {
        client.release();
    }
};
