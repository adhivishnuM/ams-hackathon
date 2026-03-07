/**
 * Firebase Admin Service
 * Centralizes Firebase Admin SDK setup for the Node.js backend.
 * Used for: Firestore (chat history), Firebase Storage (WhatsApp session).
 */

const admin = require('firebase-admin');

let db = null;
let storage = null;
let initialized = false;

function initFirebase() {
    if (initialized) return;

    try {
        // Option 1: Use service account JSON from env variable
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`
            });
            db = admin.firestore();
            storage = admin.storage();
            initialized = true;
            console.log('✅ Firebase Admin initialized with service account');
            return;
        }

        // Option 2: Use Application Default Credentials (if running on GCP/Firebase)
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`
        });
        db = admin.firestore();
        storage = admin.storage();
        initialized = true;
        console.log('✅ Firebase Admin initialized with application default credentials');
    } catch (err) {
        console.warn('⚠️ Firebase Admin SDK not initialized:', err.message);
        console.warn('   Set FIREBASE_SERVICE_ACCOUNT env var to enable Firebase features.');
        initialized = false; // Mark as failed but don't crash
    }
}

// Lazy initialization
function getDb() {
    if (!initialized) initFirebase();
    return db;
}

function getStorage() {
    if (!initialized) initFirebase();
    return storage;
}

module.exports = { getDb, getStorage, initFirebase };
