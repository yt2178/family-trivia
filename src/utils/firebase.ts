import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase configuration for family-trivia-sync
// This database has open read/write rules for /rooms/* to allow zero-configuration rooms
const firebaseConfig = {
  apiKey: "AIzaSyDEd36_d7b8P27S9v12_Lp34M56N78O90P",
  authDomain: "family-trivia-sync.firebaseapp.com",
  databaseURL: "https://family-trivia-sync-default-rtdb.firebaseio.com",
  projectId: "family-trivia-sync",
  storageBucket: "family-trivia-sync.appspot.com",
  messagingSenderId: "367258917392",
  appId: "1:367258917392:web:a1b2c3d4e5f6g7h8i9j0k1"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
