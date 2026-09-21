const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Générateur de token JWT
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET || 'secret_jwt_projet_boutik',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// @desc    Inscription d'un nouvel utilisateur (CLIENT, VENDEUR, ADMIN)
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
    const client = await db.connect();
    try {
        const { nom, email, telephone, mot_de_passe, role, adresse_residence, latitude, longitude } = req.body;

        // 1. Validation des champs requis
        if (!nom || !email || !telephone || !mot_de_passe) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez remplir tous les champs obligatoires (nom, email, téléphone, mot de passe).'
            });
        }

        const roleUtilisateur = (role && ['CLIENT', 'VENDEUR', 'ADMIN'].includes(role.toUpperCase())) 
            ? role.toUpperCase() 
            : 'CLIENT';

        // 2. Vérifier si l'utilisateur existe déjà
        const userExists = await client.query(
            'SELECT id FROM utilisateurs WHERE email = $1 OR telephone = $2',
            [email.toLowerCase().trim(), telephone.trim()]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Un utilisateur avec cet email ou ce numéro de téléphone existe déjà.'
            });
        }

        await client.query('BEGIN');

        // 3. Hacher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(mot_de_passe, salt);

        // 4. Insérer dans 'utilisateurs'
        const insertUserQuery = `
            INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, nom, email, telephone, role, date_inscription
        `;
        const userResult = await client.query(insertUserQuery, [
            nom.trim(),
            email.toLowerCase().trim(),
            telephone.trim(),
            hashedPassword,
            roleUtilisateur
        ]);
        const newUser = userResult.rows[0];

        // 5. Initialiser les profils spécifiques selon le rôle
        let clientProfile = null;
        let vendeurProfile = null;

        if (roleUtilisateur === 'CLIENT') {
            const clientRes = await client.query(
                `INSERT INTO clients (utilisateur_id, adresse_residence, latitude, longitude)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [newUser.id, adresse_residence || null, latitude || null, longitude || null]
            );
            clientProfile = clientRes.rows[0];

            // Créer automatiquement le panier associé
            await client.query(
                `INSERT INTO paniers (client_id, montant_total) VALUES ($1, 0.00) RETURNING id`,
                [newUser.id]
            );
        } else if (roleUtilisateur === 'VENDEUR') {
            // 1 mois d'abonnement offert au démarrage
            const dateFinEssai = new Date();
            dateFinEssai.setMonth(dateFinEssai.getMonth() + 1);

            const vendeurRes = await client.query(
                `INSERT INTO vendeurs (utilisateur_id, est_abonne, date_fin_abonnement)
                 VALUES ($1, true, $2)
                 RETURNING *`,
                [newUser.id, dateFinEssai]
            );
            vendeurProfile = vendeurRes.rows[0];
        }

        // 6. Créer une notification de bienvenue
        await client.query(
            `INSERT INTO notifications (utilisateur_id, type, titre, message)
             VALUES ($1, 'SYSTEME', 'Bienvenue sur ProjetBoutik !', $2)`,
            [
                newUser.id,
                roleUtilisateur === 'VENDEUR'
                    ? 'Bienvenue ! Vous disposez d\'un mois d\'abonnement offert. Créez votre boutique dès maintenant.'
                    : 'Bienvenue sur la marketplace locale ! Découvrez les commerces et produits autour de vous.'
            ]
        );

        await client.query('COMMIT');

        const token = generateToken(newUser);

        res.status(201).json({
            success: true,
            message: 'Compte créé avec succès.',
            token,
            data: {
                ...newUser,
                profile: clientProfile || vendeurProfile
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur inscription :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Connexion d'un utilisateur
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
    try {
        const { email, mot_de_passe } = req.body;

        if (!email || !mot_de_passe) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir un email (ou téléphone) et un mot de passe.'
            });
        }

        // Recherche par email ou numéro de téléphone
        const result = await db.query(
            `SELECT * FROM utilisateurs WHERE email = $1 OR telephone = $1`,
            [email.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants invalides.'
            });
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants invalides.'
            });
        }

        delete user.mot_de_passe;

        // Récupérer les informations supplémentaires du profil
        let profile = null;
        let boutique = null;

        if (user.role === 'CLIENT') {
            const clientRes = await db.query('SELECT * FROM clients WHERE utilisateur_id = $1', [user.id]);
            profile = clientRes.rows[0] || null;
        } else if (user.role === 'VENDEUR') {
            const vendeurRes = await db.query('SELECT * FROM vendeurs WHERE utilisateur_id = $1', [user.id]);
            profile = vendeurRes.rows[0] || null;

            const boutiqueRes = await db.query('SELECT * FROM boutiques WHERE vendeur_id = $1', [user.id]);
            boutique = boutiqueRes.rows[0] || null;
        }

        const token = generateToken(user);

        res.status(200).json({
            success: true,
            message: 'Connexion réussie.',
            token,
            data: {
                ...user,
                profile,
                boutique
            }
        });
    } catch (error) {
        console.error('Erreur connexion :', error);
        next(error);
    }
};

// @desc    Obtenir le profil de l'utilisateur connecté
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
    try {
        const userRes = await db.query(
            'SELECT id, nom, email, telephone, role, date_inscription, updated_at FROM utilisateurs WHERE id = $1',
            [req.user.id]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable.'
            });
        }

        const user = userRes.rows[0];
        let profile = null;
        let boutique = null;
        let panierId = null;

        if (user.role === 'CLIENT') {
            const clientRes = await db.query('SELECT * FROM clients WHERE utilisateur_id = $1', [user.id]);
            profile = clientRes.rows[0] || null;

            const panierRes = await db.query('SELECT id FROM paniers WHERE client_id = $1', [user.id]);
            if (panierRes.rows.length > 0) {
                panierId = panierRes.rows[0].id;
            }
        } else if (user.role === 'VENDEUR') {
            const vendeurRes = await db.query('SELECT * FROM vendeurs WHERE utilisateur_id = $1', [user.id]);
            profile = vendeurRes.rows[0] || null;

            const boutiqueRes = await db.query(
                `SELECT b.*, s.nb_vues_boutique, s.nb_vues_produits, s.nb_clics_whatsapp, s.nb_appels, s.total_recettes_app
                 FROM boutiques b
                 LEFT JOIN statistiques_vendeurs s ON b.id = s.boutique_id
                 WHERE b.vendeur_id = $1`,
                [user.id]
            );
            boutique = boutiqueRes.rows[0] || null;
        }

        res.status(200).json({
            success: true,
            data: {
                ...user,
                panierId,
                profile,
                boutique
            }
        });
    } catch (error) {
        console.error('Erreur getMe :', error);
        next(error);
    }
};

// @desc    Mettre à jour le profil de l'utilisateur connecté
// @route   PUT /api/auth/me
exports.updateProfile = async (req, res, next) => {
    const client = await db.connect();
    try {
        const { nom, telephone, adresse_residence, latitude, longitude } = req.body;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Mettre à jour 'utilisateurs'
        const updateFields = [];
        const updateValues = [];
        let index = 1;

        if (nom) {
            updateFields.push(`nom = $${index++}`);
            updateValues.push(nom.trim());
        }
        if (telephone) {
            updateFields.push(`telephone = $${index++}`);
            updateValues.push(telephone.trim());
        }
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        updateValues.push(userId);
        const userUpdateQuery = `
            UPDATE utilisateurs
            SET ${updateFields.join(', ')}
            WHERE id = $${index}
            RETURNING id, nom, email, telephone, role, date_inscription, updated_at
        `;
        const userRes = await client.query(userUpdateQuery, updateValues);
        const updatedUser = userRes.rows[0];

        // Mettre à jour 'clients' si rôle CLIENT
        let updatedProfile = null;
        if (req.user.role === 'CLIENT' && (adresse_residence !== undefined || latitude !== undefined || longitude !== undefined)) {
            const clientRes = await client.query(
                `INSERT INTO clients (utilisateur_id, adresse_residence, latitude, longitude)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (utilisateur_id) 
                 DO UPDATE SET 
                    adresse_residence = COALESCE(EXCLUDED.adresse_residence, clients.adresse_residence),
                    latitude = COALESCE(EXCLUDED.latitude, clients.latitude),
                    longitude = COALESCE(EXCLUDED.longitude, clients.longitude)
                 RETURNING *`,
                [userId, adresse_residence || null, latitude || null, longitude || null]
            );
            updatedProfile = clientRes.rows[0];
        }

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Profil mis à jour avec succès.',
            data: {
                ...updatedUser,
                profile: updatedProfile
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur updateProfile :', error);
        next(error);
    } finally {
        client.release();
    }
};

// @desc    Changer de mot de passe
// @route   PUT /api/auth/password
exports.changePassword = async (req, res, next) => {
    try {
        const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
        const userId = req.user.id;

        if (!ancien_mot_de_passe || !nouveau_mot_de_passe) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir l\'ancien et le nouveau mot de passe.'
            });
        }

        const userRes = await db.query('SELECT mot_de_passe FROM utilisateurs WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        const isMatch = await bcrypt.compare(ancien_mot_de_passe, userRes.rows[0].mot_de_passe);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'L\'ancien mot de passe est incorrect.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(nouveau_mot_de_passe, salt);

        await db.query(
            'UPDATE utilisateurs SET mot_de_passe = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, userId]
        );

        res.status(200).json({
            success: true,
            message: 'Mot de passe modifié avec succès.'
        });
    } catch (error) {
        console.error('Erreur changePassword :', error);
        next(error);
    }
};