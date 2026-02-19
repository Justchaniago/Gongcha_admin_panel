import { db } from "@/lib/firebaseClient";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

// Tambah atau update user
export async function addUser(uid: string, data: any) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// Tambah atau update staff
export async function addStaff(uid: string, data: any) {
  await setDoc(doc(db, "staff", uid), data, { merge: true });
}

// Update user
export async function updateUser(uid: string, data: any) {
  await updateDoc(doc(db, "users", uid), data);
}

// Update staff
export async function updateStaff(uid: string, data: any) {
  await updateDoc(doc(db, "staff", uid), data);
}

// Hapus user
export async function deleteUser(uid: string) {
  await deleteDoc(doc(db, "users", uid));
}

// Hapus staff
export async function deleteStaff(uid: string) {
  await deleteDoc(doc(db, "staff", uid));
}
