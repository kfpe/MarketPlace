const jwt = require('jsonwebtoken');

// Middleware pour vérifier si l'utilisateur est connecté via son Token JWT
exports.protect = async (req, res, next) => {
    let token;

    // 1. Vérifier si le token est présent dans les entêtes (Headers) HTTP
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Extraire le token de la chaîne "Bearer <TOKEN>"
            token = req.headers.authorization.split(' ')[1];

            // Décoder et vérifier la validité du token avec la clé secrète
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Stocker les infos de l'utilisateur (id, role) dans l'objet req
            req.user = decoded;

            // Passer à l'étape / contrôleur suivant
            next();
        } catch (error) {
            console.error('Erreur de vérification du Token :', error.message);
            return res.status(401).json({
                success: false,
                message: 'Non autorisé : Token invalide ou expiré.'
            });
        }
    }

    // Si aucun token n'est fourni
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Non autorisé : Aucun token fourni.'
        });
    }
};

// Middleware optionnel pour restreindre l'accès à certains rôles (ex: 'VENDEUR', 'ADMIN')
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Accès refusé : Le rôle [${req.user.role}] n'a pas la permission d'effectuer cette action.`
            });
        }
        next();
    };
};