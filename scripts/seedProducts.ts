import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";

// Load env variables dengan aman di ES Module
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Initialize Firebase Admin (Menggunakan metode Base64 persis seperti di aplikasi utamamu)
if (!admin.apps?.length) {
  const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!base64Key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 env var tidak ditemukan di .env.local.");
  }
  
  // Decode Base64 ke JSON
  const serviceAccount = JSON.parse(
    Buffer.from(base64Key, "base64").toString("utf-8")
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// 31 Data JSON Minuman
const products = [
  { "name": "Gong Cha Tea", "category": "Signature", "mediumPrice": 29000, "availableLarge": true, "availableHot": false },
  { "name": "Gong Cha Wintermelon", "category": "Signature", "mediumPrice": 29000, "availableLarge": true, "availableHot": false },
  { "name": "Gong Cha Milk Coffee", "category": "Signature", "mediumPrice": 35000, "availableLarge": false, "availableHot": false },
  { "name": "Gong Cha Milo", "category": "Signature", "mediumPrice": 35000, "availableLarge": false, "availableHot": false },
  { "name": "Milk Tea", "category": "MilkTea", "mediumPrice": 28000, "availableLarge": true, "availableHot": true },
  { "name": "Pearl Milk Tea", "category": "MilkTea", "mediumPrice": 32000, "availableLarge": true, "availableHot": true },
  { "name": "Milk Tea w Herbal Jelly", "category": "MilkTea", "mediumPrice": 32000, "availableLarge": true, "availableHot": false },
  { "name": "Earl Grey Milk Tea", "category": "MilkTea", "mediumPrice": 37000, "availableLarge": true, "availableHot": false },
  { "name": "Taro Milk", "category": "MilkTea", "mediumPrice": 35000, "availableLarge": true, "availableHot": true },
  { "name": "Chocolate Milk", "category": "MilkTea", "mediumPrice": 35000, "availableLarge": true, "availableHot": true },
  { "name": "Strawberry Milk Tea", "category": "MilkTea", "mediumPrice": 39000, "availableLarge": true, "availableHot": false },
  { "name": "Black Coffee", "category": "Coffee", "mediumPrice": 28000, "availableLarge": false, "availableHot": false },
  { "name": "Dolce Milk Coffee", "category": "Coffee", "mediumPrice": 26000, "availableLarge": false, "availableHot": false },
  { "name": "Matcha Latte", "category": "Matcha", "mediumPrice": 35000, "availableLarge": true, "availableHot": false },
  { "name": "Matcha Milk Tea w Foam", "category": "Matcha", "mediumPrice": 41000, "availableLarge": false, "availableHot": false },
  { "name": "Mint Choco Smoothie", "category": "Mint", "mediumPrice": 52000, "availableLarge": false, "availableHot": false },
  { "name": "Mint Choco Milk Tea w Pearl", "category": "Mint", "mediumPrice": 45000, "availableLarge": false, "availableHot": false },
  { "name": "Brown Sugar Milk Tea w Pearl", "category": "BrownSugar", "mediumPrice": 39000, "availableLarge": true, "availableHot": true },
  { "name": "Brown Sugar Milk Coffee", "category": "BrownSugar", "mediumPrice": 35000, "availableLarge": false, "availableHot": false },
  { "name": "Brown Sugar Fresh Milk w Pearl", "category": "BrownSugar", "mediumPrice": 39000, "availableLarge": true, "availableHot": true },
  { "name": "OO Passion Fruit Green Tea", "category": "CreativeMix", "mediumPrice": 42000, "availableLarge": true, "availableHot": false },
  { "name": "Lemon Juice w White Pearl & Aiyu", "category": "CreativeMix", "mediumPrice": 42000, "availableLarge": true, "availableHot": false },
  { "name": "Passion Fruit Peach Green Tea", "category": "CreativeMix", "mediumPrice": 34000, "availableLarge": true, "availableHot": false },
  { "name": "Peach Green Tea", "category": "CreativeMix", "mediumPrice": 32000, "availableLarge": true, "availableHot": false },
  { "name": "Lemon Wintermelon", "category": "CreativeMix", "mediumPrice": 32000, "availableLarge": true, "availableHot": false },
  { "name": "Green Tea Yakult", "category": "CreativeMix", "mediumPrice": 31000, "availableLarge": true, "availableHot": false },
  { "name": "Mango Yakult", "category": "CreativeMix", "mediumPrice": 33000, "availableLarge": true, "availableHot": true },
  { "name": "Black Tea", "category": "BrewedTea", "mediumPrice": 24000, "availableLarge": true, "availableHot": false },
  { "name": "Oolong Tea", "category": "BrewedTea", "mediumPrice": 25000, "availableLarge": true, "availableHot": false },
  { "name": "Green Tea", "category": "BrewedTea", "mediumPrice": 24000, "availableLarge": true, "availableHot": false },
  { "name": "Alisan Tea", "category": "BrewedTea", "mediumPrice": 25000, "availableLarge": true, "availableHot": false },
  { "name": "Wintermelon Tea", "category": "BrewedTea", "mediumPrice": 24000, "availableLarge": true, "availableHot": false }
];

async function seedProducts() {
  console.log("🌱 Menyiapkan 31 data produk ke Firestore koleksi 'products'...");
  let count = 0;
  
  for (const item of products) {
    // Tambahkan field default yang belum ada di JSON
    const payload = {
      ...item,
      description: "", 
      image: "",
      rating: 5.0,
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("products").add(payload);
    count++;
    console.log(`✅ [${count}/31] Inserted: ${item.name}`);
  }

  console.log("🚀 Selesai! Semua data berhasil dimasukkan.");
  process.exit(0);
}

seedProducts().catch((error) => {
  console.error("❌ Terjadi kesalahan:", error);
  process.exit(1);
});