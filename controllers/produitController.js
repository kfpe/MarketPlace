const db = require('../config/db');

// @desc    Obtenir tous les produits avec filtres avancés (recherche, catégorie, prix, quartier, boutique)
// @route   GET /api/produits
exports.getProduits = async (req, res, next) => {
    try {
        const {
            search,
            categorie_id,
            boutique_id,
            quartier,
            min_prix,
            max_prix,
            disponible,
            statut_stock,
            limit = 50,
            page = 1
        } = req.query;

        const offset = (page - 1) * limit;
        const queryParams = [];
        const whereClauses = ["b.statut = 'VERIFIEE'"];

        // Recherche par mot-clé (nom produit, description, nom boutique)
        if (search) {
            queryParams.push(`%${search.toLowerCase()}%`);
            whereClauses.push(`(LOWER(p.nom) LIKE $${queryParams.length} OR LOWER(p.description) LIKE $${queryParams.length} OR LOWER(b.nom_boutique) LIKE $${queryParams.length})`);
        }

        // Filtre par catégorie
        if (categorie_id) {
            queryParams.push(parseInt(categorie_id));
            whereClauses.push(`p.categorie_id = $${queryParams.length}`);
        }

        // Filtre par boutique
        if (boutique_id) {
            queryParams.push(parseInt(boutique_id));
            whereClauses.push(`p.boutique_id = $${queryParams.length}`);
        }

        // Filtre par quartier
        if (quartier) {
            queryParams.push(`%${quartier.toLowerCase()}%`);
            whereClauses.push(`LOWER(b.quartier) LIKE $${queryParams.length}`);
        }

        // Filtre de prix min / max
        if (min_prix) {
            queryParams.push(parseFloat(min_prix));
            whereClauses.push(`p.prix >= $${queryParams.length}`);
        }
        if (max_prix) {
            queryParams.push(parseFloat(max_prix));
            whereClauses.push(`p.prix <= $${queryParams.length}`);
        }

        // Filtre disponibilité
        if (disponible !== undefined) {
            queryParams.push(disponible === 'true' || disponible === true);
            whereClauses.push(`p.disponible = $${queryParams.length}`);
        } else {
            // Par défaut afficher uniquement les produits disponibles
            whereClauses.push(`p.disponible = true`);
        }

        // Filtre statut_stock
        if (statut_stock) {
            queryParams.push(statut_stock);
            whereClauses.push(`p.statut_stock = $${queryParams.length}`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        queryParams.push(parseInt(limit), parseInt(offset));
        const limitIdx = queryParams.length - 1;
        const offsetIdx = queryParams.length;

        const query = `
            SELECT 
                p.*,
                c.nom AS categorie_nom,
                c.icone AS categorie_icone,
                b.nom_boutique,
                b.logo AS boutique_logo,
                b.quartier AS boutique_quartier,
                b.contact_whatsapp AS boutique_whatsapp,
                b.point_repere AS boutique_point_repere
            FROM produits p
            JOIN boutiques b ON p.boutique_id = b.id
            LEFT JOIN categories c ON p.categorie_id = c.id
            ${whereSql}
            ORDER BY p.created_at DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;

        const result = await db.query(query, queryParams);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            page: parseInt(page),
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getProduits :', error);
        next(error);
    }
};

// @desc    Obtenir les détails d'un produit
// @route   GET /api/produits/:id
exports.getProduitById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                p.*,
                c.nom AS categorie_nom,
                b.nom_boutique,
                b.logo AS boutique_logo,
                b.description AS boutique_description,
                b.quartier AS boutique_quartier,
                b.point_repere AS boutique_point_repere,
                b.contact_whatsapp AS boutique_whatsapp,
                b.vendeur_id
            FROM produits p
            JOIN boutiques b ON p.boutique_id = b.id
            LEFT JOIN categories c ON p.categorie_id = c.id
            WHERE p.id = $1
        `;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit introuvable.'
            });
        }

        const produit = result.rows[0];

        // Incrémenter les vues de produit pour les stats vendeur
        await db.query(
            `UPDATE statistiques_vendeurs 
             SET nb_vues_produits = nb_vues_produits + 1 
             WHERE boutique_id = $1`,
            [produit.boutique_id]
        );

        res.status(200).json({
            success: true,
            data: produit
        });
    } catch (error) {
        console.error('Erreur getProduitById :', error);
        next(error);
    }
};

// @desc    Créer un nouveau produit (Vendeur propriétaire)
// @route   POST /api/produits
exports.createProduit = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { nom, description, prix, categorie_id, photos, disponible = true, statut_stock = 'EN_STOCK' } = req.body;

        if (!nom || prix === undefined || !categorie_id) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir le nom, le prix et la catégorie du produit.'
            });
        }

        // Trouver la boutique du vendeur
        const boutiqueRes = await db.query('SELECT id, statut FROM boutiques WHERE vendeur_id = $1', [userId]);
        if (boutiqueRes.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vous devez créer une boutique avant d\'ajouter des produits.'
            });
        }

        const boutiqueId = boutiqueRes.rows[0].id;
        const photosArray = Array.isArray(photos) ? photos : (photos ? [photos] : []);

        const insertQuery = `
            INSERT INTO produits (boutique_id, categorie_id, nom, description, prix, photos, disponible, statut_stock)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const result = await db.query(insertQuery, [
            boutiqueId,
            parseInt(categorie_id),
            nom.trim(),
            description || null,
            parseFloat(prix),
            photosArray,
            disponible,
            statut_stock
        ]);

        res.status(201).json({
            success: true,
            message: 'Produit ajouté avec succès.',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur createProduit :', error);
        next(error);
    }
};

// @desc    Mettre à jour un produit (Vendeur propriétaire ou Admin)
// @route   PUT /api/produits/:id
exports.updateProduit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Vérifier l'existence du produit et l'appartenance à la boutique
        const checkRes = await db.query(
            `SELECT p.*, b.vendeur_id 
             FROM produits p 
             JOIN boutiques b ON p.boutique_id = b.id 
             WHERE p.id = $1`,
            [id]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Produit introuvable.' });
        }

        const currentProduct = checkRes.rows[0];

        if (currentProduct.vendeur_id !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à modifier ce produit.'
            });
        }

        const { nom, description, prix, categorie_id, photos, disponible, statut_stock } = req.body;

        const updateQuery = `
            UPDATE produits
            SET 
                nom = COALESCE($1, nom),
                description = COALESCE($2, description),
                prix = COALESCE($3, prix),
                categorie_id = COALESCE($4, categorie_id),
                photos = COALESCE($5, photos),
                disponible = COALESCE($6, disponible),
                statut_stock = COALESCE($7, statut_stock),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        `;

        const photosArray = photos !== undefined ? (Array.isArray(photos) ? photos : [photos]) : null;

        const result = await db.query(updateQuery, [
            nom ? nom.trim() : null,
            description !== undefined ? description : null,
            prix !== undefined ? parseFloat(prix) : null,
            categorie_id !== undefined ? parseInt(categorie_id) : null,
            photosArray,
            disponible !== undefined ? disponible : null,
            statut_stock !== undefined ? statut_stock : null,
            id
        ]);

        res.status(200).json({
            success: true,
            message: 'Produit mis à jour avec succès.',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur updateProduit :', error);
        next(error);
    }
};

// @desc    Supprimer un produit
// @route   DELETE /api/produits/:id
exports.deleteProduit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const checkRes = await db.query(
            `SELECT p.*, b.vendeur_id 
             FROM produits p 
             JOIN boutiques b ON p.boutique_id = b.id 
             WHERE p.id = $1`,
            [id]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Produit introuvable.' });
        }

        const currentProduct = checkRes.rows[0];

        if (currentProduct.vendeur_id !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à supprimer ce produit.'
            });
        }

        await db.query('DELETE FROM produits WHERE id = $1', [id]);

        res.status(200).json({
            success: true,
            message: 'Produit supprimé avec succès.'
        });
    } catch (error) {
        console.error('Erreur deleteProduit :', error);
        next(error);
    }
};

// @desc    Basculer la disponibilité / statut du stock d'un produit
// @route   PATCH /api/produits/:id/toggle-dispo
exports.toggleDisponibilite = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const checkRes = await db.query(
            `SELECT p.*, b.vendeur_id 
             FROM produits p 
             JOIN boutiques b ON p.boutique_id = b.id 
             WHERE p.id = $1`,
            [id]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Produit introuvable.' });
        }

        const currentProduct = checkRes.rows[0];
        if (currentProduct.vendeur_id !== userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Non autorisé.' });
        }

        const newDispo = !currentProduct.disponible;
        const newStock = newDispo ? 'EN_STOCK' : 'RUPTURE';

        const result = await db.query(
            `UPDATE produits 
             SET disponible = $1, statut_stock = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3 
             RETURNING *`,
            [newDispo, newStock, id]
        );

        res.status(200).json({
            success: true,
            message: `Disponibilité mise à jour (${newDispo ? 'Disponible' : 'Indisponible'}).`,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur toggleDisponibilite :', error);
        next(error);
    }
};
