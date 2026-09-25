import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// तुम्ही दिलेल्या माहितीनुसार Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDo0JZJprn5SWb11gnCzI-Hk22G5jGbplI",
  authDomain: "lab-component-system.firebaseapp.com",
  projectId: "lab-component-system",
  storageBucket: "lab-component-system.firebasestorage.app",
  messagingSenderId: "92081415477",
  appId: "1:92081415477:web:bf51a975f654b7e42b187c",
  measurementId: "G-9P33YEKMDY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
