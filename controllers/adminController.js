const db = require('../config/db');

// @desc    Obtenir les métriques et statistiques globales de la marketplace (Admin)
// @route   GET /api/admin/metrics
exports.getMetrics = async (req, res, next) => {
    try {
        // Utilisateurs
        const usersCountRes = await db.query(`
            SELECT 
                COUNT(*)::int AS total_utilisateurs,
                COUNT(CASE WHEN role = 'CLIENT' THEN 1 END)::int AS total_clients,
                COUNT(CASE WHEN role = 'VENDEUR' THEN 1 END)::int AS total_vendeurs,
                COUNT(CASE WHEN role = 'ADMIN' THEN 1 END)::int AS total_admins
            FROM utilisateurs
        `);

        // Boutiques
        const boutiquesCountRes = await db.query(`
            SELECT 
                COUNT(*)::int AS total_boutiques,
                COUNT(CASE WHEN statut = 'VERIFIEE' THEN 1 END)::int AS boutiques_verifiees,
                COUNT(CASE WHEN statut = 'EN_ATTENTE' THEN 1 END)::int AS boutiques_en_attente,
                COUNT(CASE WHEN statut = 'SUSPENDUE' THEN 1 END)::int AS boutiques_suspendues
            FROM boutiques
        `);

        // Produits
        const produitsCountRes = await db.query(`
            SELECT 
                COUNT(*)::int AS total_produits,
                COUNT(CASE WHEN disponible = true THEN 1 END)::int AS produits_disponibles
            FROM produits
        `);

        // Commandes & Chiffre d'affaires
        const commandesCountRes = await db.query(`
            SELECT 
                COUNT(*)::int AS total_commandes,
                COUNT(CASE WHEN statut = 'LIVREE' THEN 1 END)::int AS commandes_livrees,
                COUNT(CASE WHEN statut = 'EN_ATTENTE' THEN 1 END)::int AS commandes_en_attente,
                COALESCE(SUM(CASE WHEN statut = 'LIVREE' THEN montant_total ELSE 0 END), 0)::numeric(12,2) AS chiffre_affaires_total
            FROM commandes
        `);

        // Statistiques d'interaction vendeur (Vues, WhatsApp, Appels)
        const statsInteractionsRes = await db.query(`
            SELECT 
                COALESCE(SUM(nb_vues_boutique), 0)::int AS total_vues_boutiques,
                COALESCE(SUM(nb_vues_produits), 0)::int AS total_vues_produits,
                COALESCE(SUM(nb_clics_whatsapp), 0)::int AS total_clics_whatsapp,
                COALESCE(SUM(nb_appels), 0)::int AS total_appels
            FROM statistiques_vendeurs
        `);

        res.status(200).json({
            success: true,
            data: {
                utilisateurs: usersCountRes.rows[0],
                boutiques: boutiquesCountRes.rows[0],
                produits: produitsCountRes.rows[0],
                commandes: commandesCountRes.rows[0],
                interactions: statsInteractionsRes.rows[0]
            }
        });
    } catch (error) {
        console.error('Erreur getMetrics :', error);
        next(error);
    }
};

// @desc    Obtenir la liste complète des boutiques pour modération (Admin)
// @route   GET /api/admin/boutiques
exports.getBoutiquesAdmin = async (req, res, next) => {
    try {
        const { statut, search } = req.query;

        const queryParams = [];
        const whereClauses = [];

        if (statut) {
            queryParams.push(statut);
            whereClauses.push(`b.statut = $${queryParams.length}`);
        }

        if (search) {
            queryParams.push(`%${search.toLowerCase()}%`);
            whereClauses.push(`(LOWER(b.nom_boutique) LIKE $${queryParams.length} OR LOWER(u.nom) LIKE $${queryParams.length} OR LOWER(b.quartier) LIKE $${queryParams.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                b.*,
                u.nom AS nom_vendeur,
                u.email AS email_vendeur,
                u.telephone AS telephone_vendeur,
                COUNT(DISTINCT p.id)::int AS nb_produits,
                COALESCE(s.nb_vues_boutique, 0) AS nb_vues_boutique,
                COALESCE(s.nb_clics_whatsapp, 0) AS nb_clics_whatsapp
            FROM boutiques b
            JOIN utilisateurs u ON b.vendeur_id = u.id
            LEFT JOIN produits p ON b.id = p.boutique_id
            LEFT JOIN statistiques_vendeurs s ON b.id = s.boutique_id
            ${whereSql}
            GROUP BY b.id, u.id, s.nb_vues_boutique, s.nb_clics_whatsapp
            ORDER BY b.created_at DESC
        `;

        const result = await db.query(query, queryParams);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getBoutiquesAdmin :', error);
        next(error);
    }
};

// @desc    Mettre à jour le statut de validation d'une boutique (Admin)
// @route   PATCH /api/admin/boutiques/:id/statut
exports.updateBoutiqueStatut = async (req, res, next) => {
    const client = await db.connect();
    try {
        const { id } = req.params;
        const { statut } = req.body;

        const validStatuts = ['EN_ATTENTE', 'VERIFIEE', 'SUSPENDUE'];
        if (!statut || !validStatuts.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Choisissez parmi : ${validStatuts.join(', ')}`
            });
        }

        await client.query('BEGIN');

        const updateRes = await client.query(
            `UPDATE boutiques 
             SET statut = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 
             RETURNING *`,
            [statut, id]
        );

        if (updateRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
        }

        const boutique = updateRes.rows[0];

        // Envoyer une notification au vendeur
        let notifMsg = `Le statut de votre boutique "${boutique.nom_boutique}" est désormais : ${statut}.`;
        if (statut === 'VERIFIEE') {
            notifMsg = `Félicitations ! Votre boutique "${boutique.nom_boutique}" a été vérifiée et est désormais visible par tous les clients.`;
        } else if (statut === 'SUSPENDUE') {
            notifMsg = `Attention : Votre boutique "${boutique.nom_boutique}" a été suspendue par l'administration. Veuillez contacter le support.`;
        }

        await client.query(
            `INSERT INTO notifications (utilisateur_id, type, titre, message)
             VALUES ($1, 'BOUTIQUE', 'Mise à jour statut boutique', $2)`,
            [boutique.vendeur_id, notifMsg]
        );

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `Boutique mise à jour (${statut}).`,
            data: boutique
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur updateBoutiqueStatut :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Obtenir la liste de tous les utilisateurs (Admin)
// @route   GET /api/admin/users
exports.getUsersAdmin = async (req, res, next) => {
    try {
        const { role, search } = req.query;

        const queryParams = [];
        const whereClauses = [];

        if (role) {
            queryParams.push(role.toUpperCase());
            whereClauses.push(`u.role = $${queryParams.length}`);
        }

        if (search) {
            queryParams.push(`%${search.toLowerCase()}%`);
            whereClauses.push(`(LOWER(u.nom) LIKE $${queryParams.length} OR LOWER(u.email) LIKE $${queryParams.length} OR LOWER(u.telephone) LIKE $${queryParams.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                u.id, u.nom, u.email, u.telephone, u.role, u.date_inscription,
                b.id AS boutique_id, b.nom_boutique, b.statut AS boutique_statut
            FROM utilisateurs u
            LEFT JOIN boutiques b ON u.id = b.vendeur_id
            ${whereSql}
            ORDER BY u.date_inscription DESC
        `;

        const result = await db.query(query, queryParams);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getUsersAdmin :', error);
        next(error);
    }
};

// @desc    Supprimer un utilisateur (Admin)
// @route   DELETE /api/admin/users/:id
exports.deleteUserAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Empêcher l'auto-suppression de l'administrateur
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas supprimer votre propre compte administrateur.'
            });
        }

        const result = await db.query('DELETE FROM utilisateurs WHERE id = $1 RETURNING id, nom, email', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        res.status(200).json({
            success: true,
            message: `Utilisateur "${result.rows[0].nom}" supprimé avec succès.`
        });
    } catch (error) {
        console.error('Erreur deleteUserAdmin :', error);
        next(error);
    }
};

// @desc    Obtenir toutes les commandes de la marketplace (Admin)
// @route   GET /api/admin/commandes
exports.getCommandesAdmin = async (req, res, next) => {
    try {
        const query = `
            SELECT 
                c.*,
                u.nom AS client_nom,
                u.telephone AS client_telephone,
                u.email AS client_email,
                COUNT(l.id)::int AS nb_articles
            FROM commandes c
            JOIN utilisateurs u ON c.client_id = u.id
            LEFT JOIN lignes_de_commande l ON c.id = l.commande_id
            GROUP BY c.id, u.id
            ORDER BY c.date_commande DESC
        `;
        const result = await db.query(query);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getCommandesAdmin :', error);
        next(error);
    }
};
