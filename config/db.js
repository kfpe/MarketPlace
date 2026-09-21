// 1. Charger la bibliothèque pg (on extrait la classe Pool)
const { Pool } = require('pg');

// 2. Charger les variables d'environnement du fichier .env
require('dotenv').config();

// 3. Créer un pool de connexions
// Un "Pool" maintient un groupe de connexions réutilisables vers PostgreSQL
// pour éviter d'ouvrir/fermer une connexion à chaque requête (ce qui serait très lent).
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// 4. Tester la connexion au démarrage
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Erreur de connexion à la base de données PostgreSQL :', err.stack);
    } else {
        console.log('✅ Connexion réussie à la base de données PostgreSQL !');
        release(); // Libère le client pour qu'il retourne dans le pool
    }
});

// 5. Exporter l'objet pool pour pouvoir faire des requêtes SQL depuis d'autres fichiers
module.exports = pool;