import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Use the Firebase Emulator if running locally
const isEmulator = typeof window !== "undefined" && window.location.hostname === "localhost";

const firebaseConfig = {
  apiKey: "AIzaSyCeSYZdPgERBcf0aKgd0F7wcATkfRt6_iY",
  authDomain: "gongcha-app-4691f.firebaseapp.com",
  projectId: "gongcha-app-4691f",
  storageBucket: "gongcha-app-4691f.firebasestorage.app",
  messagingSenderId: "808600152798",
  appId: "1:808600152798:web:97bbdbf4beafc20d27b04f",
  measurementId: "G-N3HRB86L4N"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (isEmulator) {
  // @ts-ignore
  import("firebase/firestore").then(({ connectFirestoreEmulator }) => {
    connectFirestoreEmulator(db, "localhost", 8080);
  });
}

export { db };