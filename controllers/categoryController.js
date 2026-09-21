const db = require('../config/db');

// @desc    Obtenir toutes les catégories avec le nombre de produits associés
// @route   GET /api/categories
exports.getCategories = async (req, res, next) => {
    try {
        const query = `
            SELECT c.*, COUNT(p.id)::int AS nb_produits
            FROM categories c
            LEFT JOIN produits p ON c.id = p.categorie_id AND p.disponible = true
            GROUP BY c.id
            ORDER BY c.nom ASC
        `;
        const result = await db.query(query);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getCategories :', error);
        next(error);
    }
};

// @desc    Obtenir une catégorie par son ID avec ses produits
// @route   GET /api/categories/:id
exports.getCategoryById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const categoryRes = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
        if (categoryRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Catégorie introuvable.'
            });
        }

        const category = categoryRes.rows[0];

        // Récupérer les produits validés de cette catégorie
        const productsRes = await db.query(
            `SELECT p.*, b.nom_boutique, b.quartier, b.contact_whatsapp
             FROM produits p
             JOIN boutiques b ON p.boutique_id = b.id
             WHERE p.categorie_id = $1 AND p.disponible = true AND b.statut = 'VERIFIEE'
             ORDER BY p.created_at DESC`,
            [id]
        );

        res.status(200).json({
            success: true,
            data: {
                ...category,
                produits: productsRes.rows
            }
        });
    } catch (error) {
        console.error('Erreur getCategoryById :', error);
        next(error);
    }
};

// @desc    Créer une nouvelle catégorie (Admin)
// @route   POST /api/categories
exports.createCategory = async (req, res, next) => {
    try {
        const { nom, icone } = req.body;

        if (!nom) {
            return res.status(400).json({
                success: false,
                message: 'Le nom de la catégorie est obligatoire.'
            });
        }

        const queryText = 'INSERT INTO categories (nom, icone) VALUES ($1, $2) RETURNING *';
        const result = await db.query(queryText, [nom.trim(), icone || null]);

        res.status(201).json({
            success: true,
            message: 'Catégorie créée avec succès.',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur createCategory :', error);
        next(error);
    }
};

// @desc    Modifier une catégorie (Admin)
// @route   PUT /api/categories/:id
exports.updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nom, icone } = req.body;

        const checkRes = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Catégorie introuvable.'
            });
        }

        const current = checkRes.rows[0];
        const updatedNom = nom !== undefined ? nom.trim() : current.nom;
        const updatedIcone = icone !== undefined ? icone : current.icone;

        const result = await db.query(
            'UPDATE categories SET nom = $1, icone = $2 WHERE id = $3 RETURNING *',
            [updatedNom, updatedIcone, id]
        );

        res.status(200).json({
            success: true,
            message: 'Catégorie mise à jour avec succès.',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur updateCategory :', error);
        next(error);
    }
};

// @desc    Supprimer une catégorie (Admin)
// @route   DELETE /api/categories/:id
exports.deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Catégorie introuvable.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Catégorie supprimée avec succès.'
        });
    } catch (error) {
        console.error('Erreur deleteCategory :', error);
        next(error);
    }
};