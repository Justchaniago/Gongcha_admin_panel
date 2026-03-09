"use client";

import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { Search, X, Store, MapPin } from "lucide-react";
import toast from "react-hot-toast";

// --- Import UI Components ---
import { LiveBadge } from "@/components/ui/LiveBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

// Tipe Data Store
type StoreItem = {
  id: string;
  name: string;
  address: string;
  status?: "OPEN" | "CLOSED" | "ALMOST_CLOSED";
  isActive?: boolean;
  phone?: string;
  mapsUrl?: string;
};

type SyncStatus = "connecting" | "live" | "error";

function getStoreStatus(store: StoreItem): "OPEN" | "CLOSED" | "ALMOST_CLOSED" {
  if (store.status) return store.status;
  return store.isActive !== false ? "OPEN" : "CLOSED";
}

export default function StoresClient({ initialStores }: { initialStores?: StoreItem[] }) {
  const [stores, setStores] = useState<StoreItem[]>(initialStores || []);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  
  const { isAdmin } = useAuth();

  // Koneksi Realtime ke Firestore
  useEffect(() => {
    const q = query(collection(db, "stores"), orderBy("name"));
    const unsub = onSnapshot(q,
      snap => { 
        setStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreItem))); 
        setSyncStatus("live"); 
      },
      err => { 
        console.error("[stores onSnapshot]", err); 
        setSyncStatus("error"); 
      }
    );
    return () => unsub();
  }, []);

  // Logika Filter & Pencarian yang Efisien
  const filtered = useMemo(() => stores.filter(s => {
    const q = search.toLowerCase();
    const ok = !q || (s.name && s.name.toLowerCase().includes(q)) || (s.address && s.address.toLowerCase().includes(q));
    const status = getStoreStatus(s);
    const f = filter === 'ALL' || (filter === 'OPEN' ? status === 'OPEN' : status !== 'OPEN');
    return ok && f;
  }), [stores, search, filter]);

  // Kalkulasi Statistik
  const totalStores = stores.length;
  const openStores = stores.filter(s => getStoreStatus(s) === 'OPEN').length;
  const closedStores = stores.filter(s => getStoreStatus(s) === 'CLOSED').length;

  // Handler
  const handleEdit = (store: StoreItem) => {
    toast("Fitur edit akan membuka modal (Tahap berikutnya)", { icon: '🚧' });
  };
  
  const handleDelete = (store: StoreItem) => {
    toast("Fitur hapus akan membuka modal konfirmasi (Tahap berikutnya)", { icon: '🚧' });
  };

  // Mengubah div pembungkus utama menjadi <main> secara semantik
  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <PageHeader 
        title="Daftar Outlet" 
        description="Pantau status operasional dan informasi lokasi cabang Gong Cha"
        rightContent={
          <>
            <LiveBadge status={syncStatus} count={totalStores} />
            {isAdmin && (
              <button 
                onClick={() => toast("Fitur tambah outlet (Tahap berikutnya)", { icon: '🚧' })}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-gray-800 transition-all focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 active:scale-95"
              >
                + Tambah Outlet
              </button>
            )}
          </>
        }
      />

      {/* ── STATS CARDS ─────────────────────────────────────────────────── */}
      <section aria-label="Statistik Outlet" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <article className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">TOTAL OUTLET</span>
          <span className="text-3xl font-black text-gray-900">{totalStores}</span>
        </article>
        <article className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">SEDANG BUKA</span>
          <span className="text-3xl font-black text-green-600">{openStores}</span>
        </article>
        <article className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">TUTUP</span>
          <span className="text-3xl font-black text-red-600">{closedStores}</span>
        </article>
      </section>

      {/* ── DATA WRAPPER & TOOLBAR ──────────────────────────────────────── */}
      <section aria-label="Daftar Detail Outlet" className="flex flex-col shadow-sm">
        <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari nama atau alamat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-[280px] transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-full sm:w-auto">
              {(['ALL', 'OPEN', 'CLOSED'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    filter === f
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f === 'ALL' ? 'Semua' : f === 'OPEN' ? 'Buka' : 'Tutup'}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm font-medium text-gray-500">
            {filtered.length} outlet
          </div>
        </div>

        {/* ── TABLE SECTION ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-b-2xl overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Info Outlet</th>
                  <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Kontak</th>
                  <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status Operasional</th>
                  <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80 bg-white">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState 
                        title="Tidak ada outlet ditemukan" 
                        description={search ? "Coba kata kunci lain atau hapus filter" : undefined}
                        icon={<Store className="w-12 h-12 text-gray-300 mb-4" />}
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                            <Store className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex flex-col max-w-[250px] whitespace-normal">
                            <span className="font-bold text-gray-900 leading-tight">{s.name}</span>
                            <div className="flex items-start gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                              <span className="text-xs text-gray-500 line-clamp-2">{s.address}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-700 font-medium text-sm">
                          {s.phone || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge variant={getStoreStatus(s) === "OPEN" ? "success" : getStoreStatus(s) === "ALMOST_CLOSED" ? "warning" : "danger"}>
                          {getStoreStatus(s) === "OPEN" ? "BUKA" : getStoreStatus(s) === "ALMOST_CLOSED" ? "SEGERA TUTUP" : "TUTUP"}
                        </StatusBadge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                         <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            {s.mapsUrl && (
                              <a
                                href={s.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                              >
                                Maps
                              </a>
                            )}
                            {isAdmin && (
                              <>
                                <button onClick={() => handleEdit(s)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">Edit</button>
                                <button onClick={() => handleDelete(s)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">Hapus</button>
                              </>
                            )}
                         </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}