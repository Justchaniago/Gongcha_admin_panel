// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCeSYZdPgERBcf0aKgd0F7wcATkfRt6_iY",
  authDomain: "gongcha-app-4691f.firebaseapp.com",
  projectId: "gongcha-app-4691f",
  storageBucket: "gongcha-app-4691f.firebasestorage.app",
  messagingSenderId: "808600152798",
  appId: "1:808600152798:web:97bbdbf4beafc20d27b04f",
  measurementId: "G-N3HRB86L4N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics: ReturnType<typeof getAnalytics> | undefined = undefined;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}
export const db = getFirestore(app);