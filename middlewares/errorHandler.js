// Middleware global de gestion des erreurs
module.exports = (err, req, res, next) => {
    console.error('❌ Erreur capturée par le middleware global :', err.stack || err.message || err);

    const statusCode = res.statusCode !== 200 ? (res.statusCode || 500) : 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Erreur interne du serveur.',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
