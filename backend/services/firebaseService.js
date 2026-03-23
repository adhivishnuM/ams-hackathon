/**
 * Firebase Admin Service
 * Provides Firestore for shared, persistent storage across all users.
 * Library items, chat history, and market analyses are stored here.
 * Falls back to local JSON files if Firebase is not configured.
 */

const admin = require('firebase-admin');

let db = null;
let initialized = false;

function initFirebase() {
    if (initialized) return db;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
        console.log('ℹ️  FIREBASE_SERVICE_ACCOUNT not set — using local file storage.');
        initialized = true;
        return null;
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        initialized = true;
        console.log('✅ Firebase Firestore initialized — data will sync across all users');
        return db;
    } catch (err) {
        console.warn('⚠️ Firebase init failed:', err.message);
        console.warn('   Falling back to local file storage.');
        initialized = true;
        return null;
    }
}

function getDb() {
    if (!initialized) initFirebase();
    return db;
}

/**
 * Check if Firestore is available
 */
function isFirestoreAvailable() {
    return !!getDb();
}

module.exports = { initFirebase, getDb, isFirestoreAvailable };
