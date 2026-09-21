const db = require('../config/db');
const bcrypt = require('bcryptjs');

const resetDatabase = async () => {
    const client = await db.connect();
    try {
        console.log('🧹 Nettoyage de la base de données (conservation de l\'admin)...');
        await client.query('BEGIN');

        // 1. Ajouter la colonne photo_banniere sur boutiques si elle n'existe pas
        await client.query(`
            ALTER TABLE boutiques ADD COLUMN IF NOT EXISTS photo_banniere TEXT;
        `);
        console.log('✅ Colonne photo_banniere vérifiée sur la table boutiques.');

        // 2. Nettoyage des données liées
        await client.query('DELETE FROM avis');
        await client.query('DELETE FROM messages');
        await client.query('DELETE FROM discussions');
        await client.query('DELETE FROM notifications');
        await client.query('DELETE FROM lignes_de_commande');
        await client.query('DELETE FROM commandes');
        await client.query('DELETE FROM paniers');
        await client.query('DELETE FROM produits');
        await client.query('DELETE FROM statistiques_vendeurs');
        await client.query('DELETE FROM boutiques');
        await client.query('DELETE FROM vendeurs');
        await client.query('DELETE FROM clients');
        await client.query("DELETE FROM utilisateurs WHERE role != 'ADMIN'");

        console.log('✅ Toutes les données utilisateurs, boutiques, produits, commandes et messages ont été purgées.');

        // 3. S'assurer que le compte Super Administrateur est présent et valide
        const adminCheck = await client.query("SELECT id, email FROM utilisateurs WHERE email = 'admin@projetboutik.com'");
        const adminHash = await bcrypt.hash('admin1234', 10);

        if (adminCheck.rows.length === 0) {
            await client.query(
                `INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe, role)
                 VALUES ('Super Administrateur', 'admin@projetboutik.com', '+237690000001', $1, 'ADMIN')`,
                [adminHash]
            );
            console.log('✅ Compte administrateur créé : admin@projetboutik.com / admin1234');
        } else {
            // Mettre à jour le mot de passe pour être sûr qu'il fonctionne
            await client.query(
                `UPDATE utilisateurs 
                 SET mot_de_passe = $1, role = 'ADMIN', nom = 'Super Administrateur'
                 WHERE email = 'admin@projetboutik.com'`,
                [adminHash]
            );
            console.log('✅ Compte administrateur existant vérifié et mot de passe réinitialisé (admin1234).');
        }

        // 4. S'assurer que les catégories de base existent
        const catCheck = await client.query('SELECT COUNT(*)::int as count FROM categories');
        if (catCheck.rows[0].count === 0) {
            const categoriesData = [
                { nom: 'Alimentation & Boissons', icone: 'fast-food' },
                { nom: 'Mode & Chaussures', icone: 'shirt' },
                { nom: 'Électronique & Téléphones', icone: 'phone-portrait' },
                { nom: 'Beauté & Bien-être', icone: 'sparkles' },
                { nom: 'Maison & Décoration', icone: 'home' },
                { nom: 'Services & Réparations', icone: 'construct' }
            ];
            for (const cat of categoriesData) {
                await client.query(
                    `INSERT INTO categories (nom, icone) VALUES ($1, $2)`,
                    [cat.nom, cat.icone]
                );
            }
            console.log('✅ Catégories réinitialisées.');
        } else {
            console.log(`✅ ${catCheck.rows[0].count} catégories disponibles.`);
        }

        await client.query('COMMIT');
        console.log('🎉 Opération terminée avec succès ! La base est propre pour créer de nouveaux comptes.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur lors de la réinitialisation :', error);
    } finally {
        client.release();
        process.exit(0);
    }
};

resetDatabase();
