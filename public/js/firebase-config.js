// public/js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDhCc-X1SRLHE6MOPBgHWLViUzgj_y6K40",
    authDomain: "lite-class.firebaseapp.com",
    projectId: "lite-class",
    storageBucket: "lite-class.firebasestorage.app",
    messagingSenderId: "628679581170",
    appId: "1:628679581170:web:b304798841967a732a5f6b",
    measurementId: "G-GJ6CBQXRCH",
    databaseURL: "https://lite-class-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, rtdb, storage, googleProvider };
