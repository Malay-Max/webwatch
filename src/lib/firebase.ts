import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  "projectId": "webwatch-telegram-notifier",
  "appId": "1:744176801126:web:366121bf3d95de942364a7",
  "storageBucket": "webwatch-telegram-notifier.firebasestorage.app",
  "apiKey": "AIzaSyCHAKh-7-EzwEUDiykF5V6A1pF_S26Ewig",
  "authDomain": "webwatch-telegram-notifier.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "744176801126"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
