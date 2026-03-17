"use client";

import React, { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Store, storeConverter } from "@/types/firestore";
import { createStore, updateStore, deleteStore } from "@/actions/storeActions";
import { useAuth } from "@/context/AuthContext";
import { useMobileSidebar } from "@/components/layout/AdminShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, Search, MapPin, Clock, Store as StoreIcon, Plus, X,
  ChevronRight, Edit3, Trash2, CheckCircle2, XCircle, AlertCircle,
  List,
} from "lucide-react";
import BentoRow, { BentoCard } from "@/components/ui/BentoRow";

// ── DYNAMIC MAP PICKER ──
const StoreMapPicker = dynamic(() => import("./StoreMapPicker"), { ssr: false });

type StoreWithId     = Store & { id: string };

// ── LOGIC HELPER ──
function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}
function getStoreOpenStatus(store: StoreWithId): "BUKA" | "TUTUP" {
  if (store.isForceClosed) return "TUTUP";
  const openMinutes  = parseTimeToMinutes(store.operationalHours?.open);
  const closeMinutes = parseTimeToMinutes(store.operationalHours?.close);
  if (openMinutes === null || closeMinutes === null) return "TUTUP";
  const now        = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (openMinutes === closeMinutes) return "BUKA";
  if (openMinutes < closeMinutes) return nowMinutes >= openMinutes && nowMinutes < closeMinutes ? "BUKA" : "TUTUP";
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes ? "BUKA" : "TUTUP";
}

// ── DESIGN TOKENS — identical to DashboardMobile / TransactionsMobile ──
const T = {
  bg:      "#F4F5F7",
  surface: "#FFFFFF",
  navy2:   "#1C2333",
  blue:    "#3B82F6",
  blueL:   "#EFF6FF",
  blueD:   "#1D4ED8",
  amber:   "#D97706",
  amberL:  "#FFFBEB",
  amberB:  "#FDE68A",
  red:     "#DC2626",
  redL:    "#FEF2F2",
  redB:    "#FECACA",
  green:   "#059669",
  greenL:  "#ECFDF5",
  greenB:  "#6EE7B7",
  tx1:     "#111827",
  tx2:     "#374151",
  tx3:     "#6B7280",
  tx4:     "#9CA3AF",
  border:  "#F3F4F6",
  border2: "#E5E7EB",
  r12: 12, r16: 16,
} as const;

// ── SHARED SYMMETRIC HEADER — identical to Dashboard & Transactions ──
const PageHeader = ({
  left, title, subtitle, right,
}: {
  left: React.ReactNode; title: string; subtitle?: React.ReactNode; right: React.ReactNode;
}) => (
  <div style={{
    flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`,
    padding: "48px 16px 12px", display: "flex", alignItems: "center",
    justifyContent: "space-between", zIndex: 30,
  }}>
    <div style={{ width: 36, flexShrink: 0 }}>{left}</div>
    <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: T.tx1, letterSpacing: "-.01em", lineHeight: 1 }}>{title}</p>
      {subtitle && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
    <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
  </div>
);

// ── BOTTOM SHEET ──
const BottomSheet = ({ isOpen, onClose, children, title }: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string;
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)", zIndex: 9998 }}
        />
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface,
            borderRadius: "24px 24px 0 0", padding: "20px 24px 48px", zIndex: 9999,
            maxHeight: "90vh", overflowY: "auto",
          }}
        >
          <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 10, margin: "0 auto 20px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: T.tx1 }}>{title}</h2>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 99, background: T.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <X size={14} color={T.tx3} />
            </button>
          </div>
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── FIELD INPUT ──
const Field = ({ label, required, ...props }: { label: string; required?: boolean; [k: string]: any }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 }}>
      {label} {required && <span style={{ color: T.red }}>*</span>}
    </label>
    <input
      style={{
        width: "100%", background: T.bg, border: `1px solid ${T.border2}`,
        borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none",
        boxSizing: "border-box" as const,
      }}
      {...props}
    />
  </div>
);

// ── MAIN ──
export default function StoresMobile({
  initialStores = [],
}: {
  initialStores?: StoreWithId[];
  showAddTrigger?: boolean;
}) {
  const { user }       = useAuth();
  const { openDrawer } = useMobileSidebar();
  const canManage      = user?.role !== "STAFF";

  const [stores,        setStores]        = useState<StoreWithId[]>(initialStores);
  const [search,        setSearch]        = useState("");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [filter,        setFilter]        = useState<"all" | "active" | "inactive">("all");
  const [selectedStore, setSelectedStore] = useState<StoreWithId | null>(null);
  const [formStore,     setFormStore]     = useState<StoreWithId | "new" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StoreWithId | null>(null);
  const [formLoading,   setFormLoading]   = useState(false);

  const [formData, setFormData] = useState({
    name: "", address: "", latitude: "", longitude: "",
    openHours: "", statusOverride: "open", isActive: true,
  });

  // Firestore real-time
  useEffect(() => {
    const q    = query(collection(db, "stores").withConverter(storeConverter), orderBy("name"));
    const unsub = onSnapshot(q, snap => setStores(snap.docs.map(d => d.data())));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => stores.filter(s => {
    const q  = search.toLowerCase();
    const ok = !q || s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q);
    const f  = filter === "all" || (filter === "active" ? s.isActive !== false : s.isActive === false);
    return ok && f;
  }), [stores, search, filter]);

  const activeCount = stores.filter(s => s.isActive !== false).length;

  const openForm = (s: StoreWithId | "new") => {
    if (s === "new") {
      setFormData({ name: "", address: "", latitude: "", longitude: "", openHours: "", statusOverride: "open", isActive: true });
    } else {
      setFormData({
        name:           s.name || "",
        address:        s.address || "",
        latitude:       s.location?.latitude  != null ? String(s.location.latitude)  : "",
        longitude:      s.location?.longitude != null ? String(s.location.longitude) : "",
        openHours:      s.operationalHours ? `${s.operationalHours.open} - ${s.operationalHours.close}` : "",
        statusOverride: s.isForceClosed ? "closed" : "open",
        isActive:       s.isActive ?? true,
      });
    }
    setFormStore(s);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return alert("Nama toko wajib diisi");
    setFormLoading(true);
    try {
      const payload = {
        name:           formData.name.trim(),
        address:        formData.address.trim(),
        latitude:       formData.latitude  !== "" ? formData.latitude  : null,
        longitude:      formData.longitude !== "" ? formData.longitude : null,
        openHours:      formData.openHours.trim(),
        statusOverride: formData.statusOverride,
        isActive:       formData.isActive,
      };
      if (formStore === "new") await createStore(payload);
      else await updateStore((formStore as StoreWithId).id, payload);
      setFormStore(null);
      setSelectedStore(null);
    } catch (e: any) { alert(e.message); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setFormLoading(true);
    try {
      await deleteStore(deleteConfirm.id);
      setDeleteConfirm(null);
      setSelectedStore(null);
    } catch (e: any) { alert(e.message); }
    finally { setFormLoading(false); }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh", background: T.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
      WebkitFontSmoothing: "antialiased", overflowX: "hidden",
    }}>

      {/* ── HEADER ── */}
      <PageHeader
        left={
          <button
            onClick={openDrawer}
            style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border2}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Menu size={18} color={T.tx1} strokeWidth={2} />
          </button>
        }
        title="Outlets"

        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setSearchOpen(v => !v)}
              style={{ width: 36, height: 36, borderRadius: 11, background: searchOpen ? T.navy2 : T.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              {searchOpen
                ? <X size={16} color="#fff" strokeWidth={2.5} />
                : <Search size={16} color={T.tx2} strokeWidth={2} />
              }
            </button>
            {canManage && (
              <button
                onClick={() => openForm("new")}
                style={{ width: 36, height: 36, borderRadius: 11, background: T.blue, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        }
      />

      {/* ── SEARCH BAR (collapsible, matching TransactionsMobile) ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: .18 }}
            style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, overflow: "hidden" }}
          >
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={14} color={T.tx4} strokeWidth={2} style={{ flexShrink: 0 }} />
              <input
                autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search store name or ID…"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: T.tx1 }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <X size={14} color={T.tx4} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "14px 14px 0" }}>

          {/* STATS BENTO */}
          <BentoRow>
            <BentoCard label="Total Stores" value={stores.length}              color={T.blue}  bg={T.blueL}  icon={StoreIcon}    delay={0}    />
            <BentoCard label="Active"        value={activeCount}                color={T.green} bg={T.greenL} icon={CheckCircle2} delay={0.05} />
            <BentoCard label="Inactive"      value={stores.length - activeCount} color={T.red}   bg={T.redL}   icon={XCircle}      delay={0.1}  />
          </BentoRow>


        </div>

        {/* ── STORE LIST ── */}
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r16, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: T.tx4 }}>No stores found</p>
              </div>
            ) : filtered.map((s, i) => {
              const isOpen = getStoreOpenStatus(s) === "BUKA";
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedStore(s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px",
                    borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                    cursor: "pointer",
                  }}
                >
                  {/* Icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: s.isActive !== false ? T.blueL : T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <StoreIcon size={18} color={s.isActive !== false ? T.blue : T.tx4} strokeWidth={2} />
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>
                      {s.name}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: ".04em",
                        color: isOpen ? T.green : T.red,
                        background: isOpen ? T.greenL : T.redL,
                        padding: "2px 7px", borderRadius: 99,
                        border: `1px solid ${isOpen ? T.greenB : T.redB}`,
                      }}>
                        {isOpen ? "BUKA" : "TUTUP"}
                      </span>
                      <span style={{ fontSize: 10, color: T.tx4, display: "flex", alignItems: "center", gap: 3 }}>
                        <Clock size={9} />
                        {s.operationalHours ? `${s.operationalHours.open} – ${s.operationalHours.close}` : "Not set"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} color={T.tx4} style={{ flexShrink: 0 }} />
                </motion.div>
              );
            })}
          </div>
          {filtered.length > 0 && (
            <p style={{ fontSize: 10, color: T.tx4, textAlign: "center", marginTop: 8 }}>
              Showing {filtered.length} store{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* ── ISLAND TAB BAR ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 28px", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.navy2, borderRadius: 99, padding: "5px 6px", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)" }}>
          {([
            { id: "all",      icon: List,         label: "All",      count: stores.length           },
            { id: "active",   icon: CheckCircle2, label: "Active",   count: activeCount             },
            { id: "inactive", icon: XCircle,      label: "Inactive", count: stores.length - activeCount },
          ] as const).map(({ id, icon: Icon, label, count }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: 99, border: "none", background: active ? T.blue : "transparent", cursor: "pointer", transition: "background .2s ease" }}
              >
                <Icon size={15} color={active ? "#fff" : "rgba(255,255,255,.4)"} strokeWidth={active ? 2.5 : 2} />
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,.38)", whiteSpace: "nowrap" }}>
                  {active ? label : `${label} ${count}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM SHEET: DETAIL ── */}
      <BottomSheet isOpen={!!selectedStore} onClose={() => setSelectedStore(null)} title="Store Details">
        {selectedStore && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: T.tx1, marginBottom: 4 }}>{selectedStore.name}</h3>
              <p style={{ fontSize: 11, color: T.tx4 }}>
                ID: <code style={{ background: T.blueL, color: T.blueD, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>{selectedStore.id}</code>
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px", background: T.bg, borderRadius: 12 }}>
                <MapPin size={16} color={T.tx4} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 4 }}>Address</p>
                  <p style={{ fontSize: 13, color: T.tx1, lineHeight: 1.5 }}>{selectedStore.address || "No address provided"}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", background: T.bg, borderRadius: 12 }}>
                <Clock size={16} color={T.tx4} style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 4 }}>Operational Hours</p>
                  <p style={{ fontSize: 13, color: T.tx1 }}>
                    {selectedStore.operationalHours ? `${selectedStore.operationalHours.open} – ${selectedStore.operationalHours.close}` : "Not set"}
                  </p>
                </div>
              </div>
              {/* Status badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", background: T.bg, borderRadius: 12 }}>
                <StoreIcon size={16} color={T.tx4} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 4 }}>Status</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
                      background: selectedStore.isActive !== false ? T.greenL : T.redL,
                      color:      selectedStore.isActive !== false ? T.green  : T.red,
                      border:     `1px solid ${selectedStore.isActive !== false ? T.greenB : T.redB}`,
                    }}>
                      {selectedStore.isActive !== false ? "Active" : "Inactive"}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
                      background: getStoreOpenStatus(selectedStore) === "BUKA" ? T.greenL : T.redL,
                      color:      getStoreOpenStatus(selectedStore) === "BUKA" ? T.green  : T.red,
                      border:     `1px solid ${getStoreOpenStatus(selectedStore) === "BUKA" ? T.greenB : T.redB}`,
                    }}>
                      {getStoreOpenStatus(selectedStore)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {canManage && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={() => { setSelectedStore(null); setTimeout(() => openForm(selectedStore), 300); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.blueL, color: T.blueD, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  onClick={() => { setSelectedStore(null); setTimeout(() => setDeleteConfirm(selectedStore), 300); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: T.redL, color: T.red, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── BOTTOM SHEET: FORM ADD/EDIT ── */}
      <BottomSheet isOpen={!!formStore} onClose={() => setFormStore(null)} title={formStore === "new" ? "Add New Store" : "Edit Store"}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Field label="Store Name" required placeholder="e.g. Gong Cha Tunjungan Plaza" value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 }}>Full Address</label>
            <textarea
              rows={3}
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: T.tx1, outline: "none", boxSizing: "border-box" as const, resize: "none" }}
              placeholder="Lantai 3, …"
              value={formData.address}
              onChange={(e: any) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Latitude"  type="number" placeholder="-7.2625"   value={formData.latitude}  onChange={(e: any) => setFormData({ ...formData, latitude: e.target.value })} />
            <Field label="Longitude" type="number" placeholder="112.7378" value={formData.longitude} onChange={(e: any) => setFormData({ ...formData, longitude: e.target.value })} />
          </div>

          <div style={{ height: 200, borderRadius: 12, overflow: "hidden", marginBottom: 14, border: `1px solid ${T.border2}` }}>
            <StoreMapPicker
              initialPoint={formData.latitude && formData.longitude ? { lat: Number(formData.latitude), lng: Number(formData.longitude) } : null}
              selectedPoint={formData.latitude && formData.longitude ? { lat: Number(formData.latitude), lng: Number(formData.longitude) } : null}
              onPick={(point: any) => setFormData({ ...formData, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6) })}
            />
          </div>

          <Field label="Opening Hours" placeholder="10:00 - 22:00" value={formData.openHours} onChange={(e: any) => setFormData({ ...formData, openHours: e.target.value })} />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: T.tx4, textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 }}>Status Override</label>
            <div style={{ position: "relative" }}>
              <select
                style={{ width: "100%", appearance: "none" as const, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "12px 36px 12px 14px", fontSize: 14, color: T.tx1, outline: "none" }}
                value={formData.statusOverride}
                onChange={(e: any) => setFormData({ ...formData, statusOverride: e.target.value })}
              >
                <option value="open">Normal (Buka sesuai jam)</option>
                <option value="almost_close">Hampir Tutup</option>
                <option value="closed">Force Close (Tutup paksa)</option>
              </select>
            </div>
          </div>

          {/* Toggle — Active */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: T.bg, borderRadius: 12, marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.tx1 }}>Store is Active</p>
              <p style={{ fontSize: 10, color: T.tx4, marginTop: 2 }}>Visible to members in the app</p>
            </div>
            <button
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              style={{ width: 44, height: 24, borderRadius: 99, border: "none", background: formData.isActive ? T.blue : T.tx4, position: "relative", transition: "background .2s", cursor: "pointer", flexShrink: 0 }}
            >
              <span style={{ position: "absolute", top: 2, left: formData.isActive ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={formLoading}
            style={{ width: "100%", padding: 16, background: T.navy2, color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: formLoading ? "default" : "pointer", opacity: formLoading ? .7 : 1 }}
          >
            {formLoading ? "Saving…" : "Save Store"}
          </button>
        </div>
      </BottomSheet>

      {/* ── BOTTOM SHEET: DELETE CONFIRM ── */}
      <BottomSheet isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Store?">
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.redL, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.redB}` }}>
            <AlertCircle size={28} color={T.red} strokeWidth={2} />
          </div>
          <p style={{ fontSize: 13, color: T.tx2, lineHeight: 1.6, marginBottom: 24 }}>
            Are you sure you want to delete <strong style={{ color: T.tx1 }}>{deleteConfirm?.name}</strong>?<br />
            <span style={{ color: T.tx4 }}>This action cannot be undone.</span>
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setDeleteConfirm(null)}
              style={{ flex: 1, padding: 14, background: "transparent", color: T.tx2, border: `1px solid ${T.border2}`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={formLoading}
              style={{ flex: 2, padding: 14, background: T.red, color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: formLoading ? "default" : "pointer", opacity: formLoading ? .7 : 1 }}
            >
              {formLoading ? "Deleting…" : "Yes, Delete"}
            </button>
          </div>
        </div>
      </BottomSheet>

      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}