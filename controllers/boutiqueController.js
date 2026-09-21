const db = require('../config/db');

// @desc    Obtenir toutes les boutiques validées (avec filtres, recherche et géolocalisation)
// @route   GET /api/boutiques
exports.getBoutiques = async (req, res, next) => {
    try {
        const { search, quartier, lat, lng, limit = 50, page = 1 } = req.query;
        const offset = (page - 1) * limit;

        const queryParams = [];
        let whereClauses = ["b.statut = 'VERIFIEE'"];

        // Recherche par mot-clé (nom ou description)
        if (search) {
            queryParams.push(`%${search.toLowerCase()}%`);
            whereClauses.push(`(LOWER(b.nom_boutique) LIKE $${queryParams.length} OR LOWER(b.description) LIKE $${queryParams.length} OR LOWER(b.quartier) LIKE $${queryParams.length})`);
        }

        // Filtre par quartier
        if (quartier) {
            queryParams.push(`%${quartier.toLowerCase()}%`);
            whereClauses.push(`LOWER(b.quartier) LIKE $${queryParams.length}`);
        }

        // Calcul de distance si coordonnées fournies
        let distanceSelect = "0 AS distance_km";
        let orderByClause = "b.created_at DESC";

        if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            queryParams.push(latitude, longitude);
            const latIdx = queryParams.length - 1;
            const lngIdx = queryParams.length;

            // Formule de Haversine pour calculer la distance en km
            distanceSelect = `
                (6371 * acos(
                    cos(radians($${latIdx})) * cos(radians(b.latitude)) *
                    cos(radians(b.longitude) - radians($${lngIdx})) +
                    sin(radians($${latIdx})) * sin(radians(b.latitude))
                )) AS distance_km
            `;
            orderByClause = "distance_km ASC, b.created_at DESC";
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        queryParams.push(parseInt(limit), parseInt(offset));
        const limitIdx = queryParams.length - 1;
        const offsetIdx = queryParams.length;

        const query = `
            SELECT 
                b.*,
                u.nom AS nom_vendeur,
                u.email AS email_vendeur,
                ${distanceSelect},
                COALESCE(AVG(a.note), 0)::numeric(2,1) AS note_moyenne,
                COUNT(DISTINCT a.id)::int AS nb_avis,
                COUNT(DISTINCT p.id)::int AS nb_produits
            FROM boutiques b
            JOIN utilisateurs u ON b.vendeur_id = u.id
            LEFT JOIN avis a ON b.id = a.boutique_id
            LEFT JOIN produits p ON b.id = p.boutique_id AND p.disponible = true
            ${whereSql}
            GROUP BY b.id, u.id
            ORDER BY ${orderByClause}
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
        console.error('Erreur getBoutiques :', error);
        next(error);
    }
};

// @desc    Obtenir les détails d'une boutique avec ses produits et avis
// @route   GET /api/boutiques/:id
exports.getBoutiqueById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const boutiqueQuery = `
            SELECT 
                b.*,
                u.nom AS nom_vendeur,
                u.telephone AS telephone_vendeur,
                u.email AS email_vendeur,
                COALESCE(AVG(a.note), 0)::numeric(2,1) AS note_moyenne,
                COUNT(DISTINCT a.id)::int AS nb_avis,
                COUNT(DISTINCT p.id)::int AS nb_produits
            FROM boutiques b
            JOIN utilisateurs u ON b.vendeur_id = u.id
            LEFT JOIN avis a ON b.id = a.boutique_id
            LEFT JOIN produits p ON b.id = p.boutique_id AND p.disponible = true
            WHERE b.id = $1
            GROUP BY b.id, u.id
        `;
        const boutiqueRes = await db.query(boutiqueQuery, [id]);

        if (boutiqueRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Boutique introuvable.'
            });
        }

        const boutique = boutiqueRes.rows[0];

        // Incrémenter les vues de la boutique
        await db.query(
            `UPDATE statistiques_vendeurs 
             SET nb_vues_boutique = nb_vues_boutique + 1 
             WHERE boutique_id = $1`,
            [id]
        );

        // Récupérer les produits disponibles de la boutique
        const productsRes = await db.query(
            `SELECT p.*, c.nom AS categorie_nom
             FROM produits p
             LEFT JOIN categories c ON p.categorie_id = c.id
             WHERE p.boutique_id = $1 AND p.disponible = true
             ORDER BY p.created_at DESC`,
            [id]
        );

        // Récupérer les 5 derniers avis
        const avisRes = await db.query(
            `SELECT a.*, u.nom AS nom_client
             FROM avis a
             JOIN utilisateurs u ON a.client_id = u.id
             WHERE a.boutique_id = $1
             ORDER BY a.date_avis DESC
             LIMIT 5`,
            [id]
        );

        res.status(200).json({
            success: true,
            data: {
                ...boutique,
                produits: productsRes.rows,
                derniers_avis: avisRes.rows
            }
        });
    } catch (error) {
        console.error('Erreur getBoutiqueById :', error);
        next(error);
    }
};

// @desc    Obtenir la boutique du vendeur connecté
// @route   GET /api/boutiques/my/shop
exports.getMyBoutique = async (req, res, next) => {
    try {
        const vendeurId = req.user.id;

        const boutiqueRes = await db.query(
            `SELECT b.*, 
                    s.nb_vues_boutique, 
                    s.nb_vues_produits, 
                    s.nb_clics_whatsapp, 
                    s.nb_appels, 
                    s.total_recettes_app,
                    COALESCE(AVG(a.note), 0)::numeric(2,1) AS note_moyenne,
                    COUNT(DISTINCT a.id)::int AS nb_avis
             FROM boutiques b
             LEFT JOIN statistiques_vendeurs s ON b.id = s.boutique_id
             LEFT JOIN avis a ON b.id = a.boutique_id
             WHERE b.vendeur_id = $1
             GROUP BY b.id, s.boutique_id, s.nb_vues_boutique, s.nb_vues_produits, s.nb_clics_whatsapp, s.nb_appels, s.total_recettes_app`,
            [vendeurId]
        );

        if (boutiqueRes.rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Aucune boutique créée pour le moment.',
                data: null
            });
        }

        const boutique = boutiqueRes.rows[0];

        // Récupérer tous les produits (y compris en rupture ou indisponibles) pour le vendeur
        const produitsRes = await db.query(
            `SELECT p.*, c.nom AS categorie_nom
             FROM produits p
             LEFT JOIN categories c ON p.categorie_id = c.id
             WHERE p.boutique_id = $1
             ORDER BY p.created_at DESC`,
            [boutique.id]
        );

        res.status(200).json({
            success: true,
            data: {
                ...boutique,
                produits: produitsRes.rows
            }
        });
    } catch (error) {
        console.error('Erreur getMyBoutique :', error);
        next(error);
    }
};

// @desc    Créer une nouvelle boutique (Vendeur)
// @route   POST /api/boutiques
exports.createBoutique = async (req, res, next) => {
    const client = await db.connect();
    try {
        const vendeurId = req.user.id;
        const {
            nom_boutique,
            logo,
            photo_banniere,
            description,
            quartier,
            point_repere,
            latitude = 0,
            longitude = 0,
            contact_whatsapp,
            horaire_ouverture
        } = req.body;

        // Validation
        if (!nom_boutique || !quartier || !contact_whatsapp) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner le nom de la boutique, le quartier et le contact WhatsApp.'
            });
        }

        // Vérifier si le vendeur a déjà une boutique
        const existing = await client.query('SELECT id FROM boutiques WHERE vendeur_id = $1', [vendeurId]);
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Vous possédez déjà une boutique enregistrée.'
            });
        }

        await client.query('BEGIN');

        // S'assurer que le rôle de l'utilisateur passe à VENDEUR s'il était CLIENT
        await client.query(`UPDATE utilisateurs SET role = 'VENDEUR' WHERE id = $1 AND role = 'CLIENT'`, [vendeurId]);
        await client.query(`
            INSERT INTO vendeurs (utilisateur_id, est_abonne) 
            VALUES ($1, true) 
            ON CONFLICT (utilisateur_id) DO NOTHING
        `, [vendeurId]);

        const insertQuery = `
            INSERT INTO boutiques (
                vendeur_id, nom_boutique, logo, photo_banniere, description,
                quartier, point_repere, latitude, longitude,
                contact_whatsapp, statut, horaire_ouverture, est_ouvert
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'EN_ATTENTE', $11, true)
            RETURNING *
        `;

        const boutiqueRes = await client.query(insertQuery, [
            vendeurId,
            nom_boutique.trim(),
            logo || null,
            photo_banniere || null,
            description || null,
            quartier.trim(),
            point_repere || null,
            parseFloat(latitude) || 0,
            parseFloat(longitude) || 0,
            contact_whatsapp.trim(),
            horaire_ouverture || null
        ]);

        const newBoutique = boutiqueRes.rows[0];

        // Créer l'entrée dans statistiques_vendeurs
        await client.query(
            `INSERT INTO statistiques_vendeurs (boutique_id, nb_vues_boutique, nb_vues_produits, nb_clics_whatsapp, nb_appels, total_recettes_app)
             VALUES ($1, 0, 0, 0, 0, 0.00)
             ON CONFLICT DO NOTHING`,
            [newBoutique.id]
        );

        // Notification envoyée au vendeur
        await client.query(
            `INSERT INTO notifications (utilisateur_id, type, titre, message)
             VALUES ($1, 'BOUTIQUE', 'Boutique en cours de validation', $2)`,
            [
                vendeurId,
                `Votre boutique "${nom_boutique}" a été soumise avec succès. Les administrateurs vont la vérifier sous peu.`
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Boutique créée avec succès. Elle est actuellement en attente de validation par l\'administrateur.',
            data: newBoutique
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur createBoutique :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Mettre à jour une boutique (Propriétaire vendeur ou Admin)
// @route   PUT /api/boutiques/:id
exports.updateBoutique = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const checkRes = await db.query('SELECT * FROM boutiques WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
        }

        const boutique = checkRes.rows[0];

        // Vérifier les droits
        if (boutique.vendeur_id !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à modifier cette boutique.'
            });
        }

        const {
            nom_boutique,
            logo,
            photo_banniere,
            description,
            quartier,
            point_repere,
            latitude,
            longitude,
            contact_whatsapp,
            horaire_ouverture,
            est_ouvert
        } = req.body;

        const updateQuery = `
            UPDATE boutiques
            SET
                nom_boutique = COALESCE($1, nom_boutique),
                logo = COALESCE($2, logo),
                photo_banniere = COALESCE($3, photo_banniere),
                description = COALESCE($4, description),
                quartier = COALESCE($5, quartier),
                point_repere = COALESCE($6, point_repere),
                latitude = COALESCE($7, latitude),
                longitude = COALESCE($8, longitude),
                contact_whatsapp = COALESCE($9, contact_whatsapp),
                horaire_ouverture = COALESCE($10, horaire_ouverture),
                est_ouvert = COALESCE($11, est_ouvert),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *
        `;

        const result = await db.query(updateQuery, [
            nom_boutique || null,
            logo !== undefined ? logo : null,
            photo_banniere !== undefined ? photo_banniere : null,
            description !== undefined ? description : null,
            quartier || null,
            point_repere !== undefined ? point_repere : null,
            latitude !== undefined ? parseFloat(latitude) : null,
            longitude !== undefined ? parseFloat(longitude) : null,
            contact_whatsapp || null,
            horaire_ouverture !== undefined ? horaire_ouverture : null,
            est_ouvert !== undefined ? est_ouvert : null,
            id
        ]);

        res.status(200).json({
            success: true,
            message: 'Boutique mise à jour avec succès.',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur updateBoutique :', error);
        next(error);
    }
};

// @desc    Incrémenter le compteur de clics WhatsApp
// @route   POST /api/boutiques/:id/click-whatsapp
exports.incrementWhatsappClick = async (req, res, next) => {
    try {
        const { id } = req.params;

        await db.query(
            `UPDATE statistiques_vendeurs
             SET nb_clics_whatsapp = nb_clics_whatsapp + 1
             WHERE boutique_id = $1`,
            [id]
        );

        res.status(200).json({ success: true, message: 'Clic WhatsApp enregistré.' });
    } catch (error) {
        console.error('Erreur incrementWhatsappClick :', error);
        next(error);
    }
};

// @desc    Incrémenter le compteur d'appels téléphoniques
// @route   POST /api/boutiques/:id/click-call
exports.incrementCallClick = async (req, res, next) => {
    try {
        const { id } = req.params;

        await db.query(
            `UPDATE statistiques_vendeurs
             SET nb_appels = nb_appels + 1
             WHERE boutique_id = $1`,
            [id]
        );

        res.status(200).json({ success: true, message: 'Clic Appel enregistré.' });
    } catch (error) {
        console.error('Erreur incrementCallClick :', error);
        next(error);
    }
};

// @desc    Ajouter un avis sur une boutique (Client connecté)
// @route   POST /api/boutiques/:id/avis
exports.addAvis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const clientId = req.user.id;
        const { note, commentaire } = req.body;

        if (!note || note < 1 || note > 5) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez donner une note valide entre 1 et 5 étoiles.'
            });
        }

        const insertQuery = `
            INSERT INTO avis (client_id, boutique_id, note, commentaire)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const result = await db.query(insertQuery, [clientId, id, parseInt(note), commentaire || null]);

        res.status(201).json({
            success: true,
            message: 'Avis enregistré avec succès.',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur addAvis :', error);
        next(error);
    }
};

// @desc    Récupérer tous les avis d'une boutique
// @route   GET /api/boutiques/:id/avis
exports.getAvis = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT a.*, u.nom AS nom_client
             FROM avis a
             JOIN utilisateurs u ON a.client_id = u.id
             WHERE a.boutique_id = $1
             ORDER BY a.date_avis DESC`,
            [id]
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getAvis :', error);
        next(error);
    }
};
