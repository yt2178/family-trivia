import { initializeApp } from 'firebase/app';
import { getDatabase, enableLogging } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Firebase configuration for family-trivia-sync
const firebaseConfig = {
  apiKey: "AIzaSyBwBu1B1eLHREM0RhdCTKinPVfhQw31kcg",
  authDomain: "family-trivia-yt2178.firebaseapp.com",
  databaseURL: "https://family-trivia-yt2178-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "family-trivia-yt2178",
  storageBucket: "family-trivia-yt2178.firebasestorage.app",
  messagingSenderId: "867206641261",
  appId: "1:867206641261:web:bda4aa42d560f2a17f3164"
};

const app = initializeApp(firebaseConfig);

// Enable logging to console so we can diagnose connection issues
enableLogging(true);

export const rtdb = getDatabase(app);
export const auth = getAuth(app);

// Automatically sign in anonymously on load
signInAnonymously(auth)
  .then(() => {
    console.log('Firebase Auth: Sign in anonymously successful!');
  })
  .catch((error) => {
    console.error('Firebase Auth: Anonymous sign in failed', error);
  });

