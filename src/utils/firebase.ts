import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase configuration for family-trivia-sync
// This database has open read/write rules for /rooms/* to allow zero-configuration rooms
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
export const rtdb = getDatabase(app);
