const db = require('../config/db');

// @desc    Obtenir la liste des discussions de l'utilisateur connecté
// @route   GET /api/discussions
exports.getDiscussions = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT 
                d.id AS discussion_id,
                d.client_id,
                d.vendeur_id,
                d.date_creation,
                -- Informations sur l'interlocuteur
                CASE 
                    WHEN d.client_id = $1 THEN u_vendeur.id 
                    ELSE u_client.id 
                END AS interlocuteur_id,
                CASE 
                    WHEN d.client_id = $1 THEN u_vendeur.nom 
                    ELSE u_client.nom 
                END AS interlocuteur_nom,
                CASE 
                    WHEN d.client_id = $1 THEN u_vendeur.telephone 
                    ELSE u_client.telephone 
                END AS interlocuteur_telephone,
                b.nom_boutique,
                b.logo AS boutique_logo,
                b.contact_whatsapp,
                -- Dernier message
                m_last.contenu AS dernier_message,
                m_last.horodatage AS dernier_message_date,
                m_last.expediteur_id AS dernier_message_expediteur_id,
                -- Nombre de messages non lus
                (
                    SELECT COUNT(*)::int 
                    FROM messages m_unread 
                    WHERE m_unread.discussion_id = d.id 
                      AND m_unread.expediteur_id != $1 
                      AND m_unread.est_lu = false
                ) AS messages_non_lus
            FROM discussions d
            JOIN utilisateurs u_client ON d.client_id = u_client.id
            JOIN utilisateurs u_vendeur ON d.vendeur_id = u_vendeur.id
            LEFT JOIN boutiques b ON b.vendeur_id = u_vendeur.id
            LEFT JOIN LATERAL (
                SELECT contenu, horodatage, expediteur_id
                FROM messages
                WHERE discussion_id = d.id
                ORDER BY horodatage DESC
                LIMIT 1
            ) m_last ON true
            WHERE d.client_id = $1 OR d.vendeur_id = $1
            ORDER BY COALESCE(m_last.horodatage, d.date_creation) DESC
        `;

        const result = await db.query(query, [userId]);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getDiscussions :', error);
        next(error);
    }
};

// @desc    Créer ou récupérer une discussion existante
// @route   POST /api/discussions
exports.createOrGetDiscussion = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { vendeur_id, boutique_id } = req.body;

        let targetVendeurId = vendeur_id;

        // Si boutique_id est passé au lieu de vendeur_id, chercher le vendeur_id
        if (!targetVendeurId && boutique_id) {
            const bRes = await db.query('SELECT vendeur_id FROM boutiques WHERE id = $1', [boutique_id]);
            if (bRes.rows.length > 0) {
                targetVendeurId = bRes.rows[0].vendeur_id;
            }
        }

        if (!targetVendeurId) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez spécifier un vendeur_id ou boutique_id valide.'
            });
        }

        if (parseInt(targetVendeurId) === userId) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas ouvrir une discussion avec vous-même.'
            });
        }

        // Vérifier si la discussion existe déjà
        const existingRes = await db.query(
            `SELECT id FROM discussions 
             WHERE (client_id = $1 AND vendeur_id = $2) 
                OR (client_id = $2 AND vendeur_id = $1)`,
            [userId, targetVendeurId]
        );

        if (existingRes.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'Discussion existante trouvée.',
                data: { id: existingRes.rows[0].id }
            });
        }

        // Créer une nouvelle discussion
        const insertRes = await db.query(
            `INSERT INTO discussions (client_id, vendeur_id) 
             VALUES ($1, $2) 
             RETURNING id, client_id, vendeur_id, date_creation`,
            [userId, targetVendeurId]
        );

        res.status(201).json({
            success: true,
            message: 'Nouvelle discussion créée.',
            data: insertRes.rows[0]
        });
    } catch (error) {
        console.error('Erreur createOrGetDiscussion :', error);
        next(error);
    }
};

// @desc    Obtenir les messages d'une discussion
// @route   GET /api/discussions/:id/messages
exports.getMessages = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Vérifier si l'utilisateur fait partie de la discussion
        const discRes = await db.query('SELECT * FROM discussions WHERE id = $1', [id]);
        if (discRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Discussion introuvable.' });
        }

        const discussion = discRes.rows[0];
        if (discussion.client_id !== userId && discussion.vendeur_id !== userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        // Marquer les messages reçus comme lus
        await db.query(
            `UPDATE messages 
             SET est_lu = true 
             WHERE discussion_id = $1 AND expediteur_id != $2 AND est_lu = false`,
            [id, userId]
        );

        // Récupérer les messages
        const messagesRes = await db.query(
            `SELECT m.*, u.nom AS nom_expediteur
             FROM messages m
             JOIN utilisateurs u ON m.expediteur_id = u.id
             WHERE m.discussion_id = $1
             ORDER BY m.horodatage ASC`,
            [id]
        );

        res.status(200).json({
            success: true,
            count: messagesRes.rows.length,
            data: messagesRes.rows
        });
    } catch (error) {
        console.error('Erreur getMessages :', error);
        next(error);
    }
};

// @desc    Envoyer un message dans une discussion
// @route   POST /api/discussions/:id/messages
exports.sendMessage = async (req, res, next) => {
    const client = await db.connect();
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { contenu, image_url } = req.body;

        const textContent = (contenu && contenu.trim()) ? contenu.trim() : (image_url ? '📷 [Photo]' : '');

        if (!textContent && !image_url) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez saisir un message ou joindre une image.'
            });
        }

        const discRes = await client.query('SELECT * FROM discussions WHERE id = $1', [id]);
        if (discRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Discussion introuvable.' });
        }

        const discussion = discRes.rows[0];
        if (discussion.client_id !== userId && discussion.vendeur_id !== userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        const destinataireId = (discussion.client_id === userId) ? discussion.vendeur_id : discussion.client_id;

        await client.query('BEGIN');

        // Insérer le message (avec image_url facultatif)
        const insertMsgQuery = `
            INSERT INTO messages (discussion_id, expediteur_id, contenu, image_url, horodatage, est_lu)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false)
            RETURNING *
        `;
        const msgRes = await client.query(insertMsgQuery, [id, userId, textContent, image_url || null]);
        const newMessage = msgRes.rows[0];

        // Récupérer le nom de l'expéditeur
        const senderRes = await client.query('SELECT nom FROM utilisateurs WHERE id = $1', [userId]);
        const senderName = senderRes.rows[0]?.nom || 'Un utilisateur';

        // Notification pour le destinataire
        await client.query(
            `INSERT INTO notifications (utilisateur_id, type, titre, message, lien_action)
             VALUES ($1, 'MESSAGE', 'Nouveau message reçu', $2, $3)`,
            [
                destinataireId,
                `${senderName} vous a envoyé un message : "${textContent.slice(0, 60)}${textContent.length > 60 ? '...' : ''}"`,
                `/discussions/${id}`
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Message envoyé.',
            data: {
                ...newMessage,
                nom_expediteur: senderName
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur sendMessage :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Obtenir le nombre total de messages non lus pour l'utilisateur connecté
// @route   GET /api/discussions/unread-count
exports.getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT COUNT(m.id)::int AS count
            FROM messages m
            JOIN discussions d ON m.discussion_id = d.id
            WHERE (d.client_id = $1 OR d.vendeur_id = $1)
              AND m.expediteur_id != $1
              AND m.est_lu = false
        `;
        const result = await db.query(query, [userId]);
        const count = result.rows[0]?.count || 0;
        res.status(200).json({ success: true, count });
    } catch (error) {
        console.error('Erreur getUnreadCount :', error);
        next(error);
    }
};

