import { db } from "@/lib/firebaseClient";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

// Helper internal untuk memvalidasi otorisasi
const checkPermission = (role: string | null) => {
  if (role !== "admin" && role !== "manager") {
    throw new Error("Akses ditolak: Hanya Admin atau Manager yang berhak melakukan perubahan data.");
  }
};

// Tambah atau update user
export async function addUser(uid: string, data: any, role: string | null) {
  checkPermission(role);
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// Tambah atau update staff
export async function addStaff(uid: string, data: any, role: string | null) {
  checkPermission(role);
  await setDoc(doc(db, "staff", uid), data, { merge: true });
}

// Update user
export async function updateUser(uid: string, data: any, role: string | null) {
  checkPermission(role);
  await updateDoc(doc(db, "users", uid), data);
}

// Update staff
export async function updateStaff(uid: string, data: any, role: string | null) {
  checkPermission(role);
  await updateDoc(doc(db, "staff", uid), data);
}

// Hapus user
export async function deleteUser(uid: string, role: string | null) {
  checkPermission(role);
  await deleteDoc(doc(db, "users", uid));
}

// Hapus staff
export async function deleteStaff(uid: string, role: string | null) {
  checkPermission(role);
  await deleteDoc(doc(db, "staff", uid));
}