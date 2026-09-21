const db = require('../config/db');

// @desc    Obtenir toutes les notifications de l'utilisateur connecté
// @route   GET /api/notifications
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            `SELECT * FROM notifications 
             WHERE utilisateur_id = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId]
        );

        const unreadCountRes = await db.query(
            `SELECT COUNT(*)::int AS non_lues 
             FROM notifications 
             WHERE utilisateur_id = $1 AND est_lue = false`,
            [userId]
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            non_lues: unreadCountRes.rows[0].non_lues,
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur getNotifications :', error);
        next(error);
    }
};

// @desc    Marquer une notification comme lue
// @route   PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            `UPDATE notifications 
             SET est_lue = true 
             WHERE id = $1 AND utilisateur_id = $2 
             RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Notification introuvable.' });
        }

        res.status(200).json({
            success: true,
            message: 'Notification marquée comme lue.',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur markAsRead :', error);
        next(error);
    }
};

// @desc    Marquer toutes les notifications comme lues
// @route   PATCH /api/notifications/read-all
exports.markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;

        await db.query(
            `UPDATE notifications 
             SET est_lue = true 
             WHERE utilisateur_id = $1 AND est_lue = false`,
            [userId]
        );

        res.status(200).json({
            success: true,
            message: 'Toutes les notifications ont été marquées comme lues.'
        });
    } catch (error) {
        console.error('Erreur markAllAsRead :', error);
        next(error);
    }
};

// @desc    Supprimer une notification
// @route   DELETE /api/notifications/:id
exports.deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            `DELETE FROM notifications WHERE id = $1 AND utilisateur_id = $2 RETURNING id`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Notification introuvable.' });
        }

        res.status(200).json({
            success: true,
            message: 'Notification supprimée.'
        });
    } catch (error) {
        console.error('Erreur deleteNotification :', error);
        next(error);
    }
};
