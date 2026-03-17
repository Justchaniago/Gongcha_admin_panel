"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";
import {
  GcButton,
  GcEmptyState,
  GcFieldLabel,
  GcInput,
  GcModalShell,
  GcPage,
  GcPageHeader,
  GcPanel,
  GcSelect,
  GcToast,
} from "@/components/ui/gc";

type RootRecord = {
  name: string;
};

type BreadcrumbItem = {
  label: string;
  path: string;
};

type AssetFolder = {
  root: string;
  name: string;
  path: string;
  fullPath: string;
};

type AssetItem = {
  root: string;
  name: string;
  path: string;
  fullPath: string;
  folderPath: string;
  fullFolderPath: string;
  sizeBytes: number;
  updatedAt: string | null;
  contentType: string | null;
  url: string;
};

type AssetListing = {
  availableRoots: RootRecord[];
  currentRoot: string;
  currentFolder: string;
  currentFullPath: string;
  currentFolderName: string;
  breadcrumb: BreadcrumbItem[];
  folders: AssetFolder[];
  assets: AssetItem[];
};

type ToastState = {
  msg: string;
  type: "success" | "error";
} | null;

const font = "Inter, system-ui, sans-serif";
const C = {
  bg: "#F4F6FB",
  white: "#FFFFFF",
  border: "#EAECF2",
  border2: "#F0F2F7",
  tx1: "#0F1117",
  tx2: "#4A5065",
  tx3: "#9299B0",
  blue: "#3B82F6",
  blueL: "#EFF6FF",
  green: "#059669",
  greenBg: "#ECFDF3",
  orange: "#D97706",
  orangeBg: "#FFFAEB",
  red: "#C8102E",
  redBg: "#FEF3F2",
  shadow: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
} as const;

const EMPTY_LISTING: AssetListing = {
  availableRoots: [{ name: "products" }, { name: "rewards" }],
  currentRoot: "products",
  currentFolder: "",
  currentFullPath: "products",
  currentFolderName: "products",
  breadcrumb: [{ label: "products", path: "" }],
  folders: [],
  assets: [],
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function folderLabel(root: string, folder: string) {
  return folder ? `${root}/${folder}` : root;
}

function getPreviewFrame(root: string) {
  if (root === "products") {
    return {
      aspectRatio: "1 / 1",
      fit: "contain" as const,
      padding: 16,
      frameBackground: "linear-gradient(180deg, #FFFDF9 0%, #F8F1E8 100%)",
      surfaceBackground: "linear-gradient(180deg, #FFFFFF 0%, #FFF9F2 100%)",
      surfaceShadow: "inset 0 1px 0 rgba(255,255,255,.92), inset 0 0 0 1px rgba(217,119,6,.08), 0 10px 22px rgba(146,64,14,.05)",
    };
  }

  return {
    aspectRatio: "4 / 3",
    fit: "contain" as const,
    padding: 12,
    frameBackground: "#F8FAFC",
    surfaceBackground: "#FFFFFF",
    surfaceShadow: "inset 0 0 0 1px rgba(15,23,42,.05)",
  };
}

function getRootBadgeStyle(root: string) {
  if (root === "products") {
    return {
      background: "linear-gradient(180deg, #FFF7ED 0%, #FFEDD5 100%)",
      border: "1px solid #F5D0A8",
      color: "#B45309",
      dot: "#D97706",
      label: "Products",
    };
  }

  return {
    background: "linear-gradient(180deg, #EFFDF6 0%, #D1FADF 100%)",
    border: "1px solid #A6F4C5",
    color: "#027A48",
    dot: "#12B76A",
    label: "Rewards",
  };
}

function Toast({ toast, onDone }: { toast: NonNullable<ToastState>; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div style={{ position: "fixed", right: 28, bottom: 28, zIndex: 999 }}>
      <GcToast msg={toast.msg} type={toast.type} />
    </div>
  );
}

function LoadingPanel({ label = "Loading asset gallery…" }: { label?: string }) {
  return (
    <GcPanel style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: C.tx2, fontSize: 13.5, fontWeight: 600 }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${C.blue}`, borderTopColor: "transparent", animation: "spin .7s linear infinite" }} />
        {label}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </GcPanel>
  );
}

function CreateFolderModal({
  currentRoot,
  currentFolder,
  onClose,
  onCreated,
}: {
  currentRoot: string;
  currentFolder: string;
  onClose: () => void;
  onCreated: (folderName: string) => Promise<void>;
}) {
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!folderName.trim()) {
      setError("Folder name is required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onCreated(folderName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to create folder.");
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      eyebrow="New Folder"
      title="Create Storage Folder"
      description={<>Folder baru akan dibuat di <strong>{folderLabel(currentRoot, currentFolder)}</strong>.</>}
      maxWidth={440}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="primary" size="lg" onClick={handleSubmit} loading={loading}>Create Folder</GcButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <GcFieldLabel required>Folder Name</GcFieldLabel>
          <GcInput
            autoFocus
            placeholder="homepage-banners"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
          />
        </div>
        {error ? <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 12.5 }}>{error}</div> : null}
      </div>
    </GcModalShell>
  );
}

function UploadAssetModal({
  currentRoot,
  currentFolder,
  onClose,
  onUploaded,
}: {
  currentRoot: string;
  currentFolder: string;
  onClose: () => void;
  onUploaded: (payload: { files: File[]; fileName?: string }) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [customFileName, setCustomFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewFrame = getPreviewFrame(currentRoot);

  const previews = useMemo(
    () =>
      files.slice(0, 4).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function setSelectedFiles(nextFiles: FileList | File[] | null) {
    if (!nextFiles) {
      setFiles([]);
      return;
    }
    const normalized = Array.from(nextFiles).filter((file) => file.type.startsWith("image/"));
    setFiles(normalized);
    if (normalized.length !== 1) {
      setCustomFileName("");
    }
  }

  async function handleSubmit() {
    if (files.length === 0) {
      setError("Select at least one image.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onUploaded({
        files,
        fileName: files.length === 1 ? customFileName.trim() || undefined : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to upload image.");
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      eyebrow="Upload Assets"
      title="Add Images to Gallery"
      description={<>Upload ke folder <strong>{folderLabel(currentRoot, currentFolder)}</strong>. Drag-and-drop dan multi-upload sudah aktif.</>}
      maxWidth={620}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="primary" size="lg" onClick={handleSubmit} loading={loading}>Upload {files.length > 1 ? `${files.length} Images` : "Image"}</GcButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <GcFieldLabel required>Drop Zone</GcFieldLabel>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              setSelectedFiles(event.dataTransfer.files);
            }}
            style={{
              borderRadius: 18,
              border: `1.5px dashed ${dragActive ? C.blue : C.border}`,
              background: dragActive ? C.blueL : "#F8FAFC",
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all .18s ease",
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 18, background: dragActive ? "#DBEAFE" : "#FFFFFF", color: C.blue, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: C.shadow }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 16V4" />
                <path d="M7 9l5-5 5 5" />
                <path d="M20 16.5v1A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-1" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: C.tx1 }}>Drop images here or click to browse</p>
            <p style={{ margin: "7px 0 0", fontSize: 12.5, color: C.tx3 }}>PNG, JPG, WEBP, GIF, SVG, AVIF. Bisa pilih banyak file sekaligus.</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setSelectedFiles(event.target.files)}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <div>
          <GcFieldLabel>Custom File Name</GcFieldLabel>
          <GcInput
            placeholder={files.length > 1 ? "Nonaktif saat multi-upload" : "hero-banner.webp"}
            value={customFileName}
            onChange={(event) => setCustomFileName(event.target.value)}
            disabled={files.length !== 1}
          />
          <p style={{ marginTop: 6, fontSize: 11.5, color: C.tx3 }}>
            Custom file name hanya dipakai jika upload satu file. Multi-upload memakai nama file asli yang disanitasi otomatis.
          </p>
        </div>

        {files.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.tx2 }}>{files.length} file selected</p>
              <button
                onClick={() => setFiles([])}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: C.red, fontSize: 12.5, fontWeight: 700, fontFamily: font }}
              >
                Clear
              </button>
            </div>
            <div className="gc-grid-4">
              {previews.map((preview) => (
                <div key={`${preview.file.name}-${preview.file.size}`} style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}`, background: "#FFFFFF" }}>
                  <div style={{ aspectRatio: previewFrame.aspectRatio, background: previewFrame.frameBackground, padding: previewFrame.padding, boxSizing: "border-box" }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", background: previewFrame.surfaceBackground, boxShadow: previewFrame.surfaceShadow }}>
                      <img src={preview.url} alt={preview.file.name} style={{ width: "100%", height: "100%", objectFit: previewFrame.fit, display: "block" }} />
                    </div>
                  </div>
                  <div style={{ padding: 10 }}>
                    <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: C.tx1, lineHeight: 1.35, wordBreak: "break-word" }}>{preview.file.name}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 10.5, color: C.tx3 }}>{formatBytes(preview.file.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 12.5 }}>{error}</div> : null}
      </div>
    </GcModalShell>
  );
}

function RenameFolderModal({
  folder,
  availableRoots,
  onClose,
  onSaved,
}: {
  folder: AssetFolder;
  availableRoots: RootRecord[];
  onClose: () => void;
  onSaved: (payload: { sourcePath: string; nextRoot: string; nextParentFolder: string; nextName: string }) => Promise<void>;
}) {
  const sourceParentFull = folder.fullPath.includes("/") ? folder.fullPath.slice(0, folder.fullPath.lastIndexOf("/")) : folder.root;
  const sourceParent = sourceParentFull === folder.root ? "" : sourceParentFull.slice(folder.root.length + 1);
  const [nextRoot, setNextRoot] = useState(folder.root);
  const [nextParentFolder, setNextParentFolder] = useState(sourceParent);
  const [nextName, setNextName] = useState(folder.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!nextName.trim()) {
      setError("Folder name is required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSaved({
        sourcePath: folder.fullPath,
        nextRoot,
        nextParentFolder: nextParentFolder.trim(),
        nextName: nextName.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to rename folder.");
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      eyebrow="Rename Folder"
      title={folder.name}
      description={<>Ubah nama atau pindahkan folder ke root/folder lain.</>}
      maxWidth={560}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="primary" size="lg" onClick={handleSubmit} loading={loading}>Save Folder</GcButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <GcFieldLabel required>Folder Name</GcFieldLabel>
          <GcInput value={nextName} onChange={(event) => setNextName(event.target.value)} />
        </div>

        <div>
          <GcFieldLabel>Root</GcFieldLabel>
          <GcSelect value={nextRoot} onChange={(event) => setNextRoot(event.target.value)}>
            {availableRoots.map((root) => <option key={root.name} value={root.name}>{root.name}</option>)}
          </GcSelect>
        </div>

        <div>
          <GcFieldLabel>Parent Folder</GcFieldLabel>
          <GcInput value={nextParentFolder} onChange={(event) => setNextParentFolder(event.target.value)} placeholder="homepage/banners" />
          <p style={{ marginTop: 6, fontSize: 11.5, color: C.tx3 }}>Kosongkan jika folder ingin berada langsung di root terpilih.</p>
        </div>

        {error ? <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 12.5 }}>{error}</div> : null}
      </div>
    </GcModalShell>
  );
}

function EditAssetModal({
  asset,
  availableRoots,
  onClose,
  onSaved,
}: {
  asset: AssetItem;
  availableRoots: RootRecord[];
  onClose: () => void;
  onSaved: (payload: { assetPath: string; nextRoot: string; nextName: string; nextFolder: string; file: File | null }) => Promise<void>;
}) {
  const previewFrame = getPreviewFrame(asset.root);
  const [nextName, setNextName] = useState(asset.name);
  const [nextRoot, setNextRoot] = useState(asset.root);
  const [nextFolder, setNextFolder] = useState(asset.folderPath);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!nextName.trim()) {
      setError("File name is required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSaved({
        assetPath: asset.fullPath,
        nextRoot,
        nextName: nextName.trim(),
        nextFolder: nextFolder.trim(),
        file: replacement,
      });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to update asset.");
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      eyebrow="Edit Asset"
      title={asset.name}
      description={<>Rename, move, atau replace image dari storage bucket.</>}
      maxWidth={560}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="primary" size="lg" onClick={handleSubmit} loading={loading}>Save Changes</GcButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}`, background: previewFrame.frameBackground, padding: previewFrame.padding, maxWidth: asset.root === "products" ? 260 : 320, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ aspectRatio: previewFrame.aspectRatio, borderRadius: 12, overflow: "hidden", background: previewFrame.surfaceBackground, boxShadow: previewFrame.surfaceShadow }}>
            <img src={asset.url} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: previewFrame.fit, display: "block" }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <GcFieldLabel required>File Name</GcFieldLabel>
            <GcInput value={nextName} onChange={(event) => setNextName(event.target.value)} />
          </div>

          <div>
            <GcFieldLabel>Root</GcFieldLabel>
            <GcSelect value={nextRoot} onChange={(event) => setNextRoot(event.target.value)}>
              {availableRoots.map((root) => <option key={root.name} value={root.name}>{root.name}</option>)}
            </GcSelect>
          </div>

          <div>
            <GcFieldLabel>Folder Path</GcFieldLabel>
            <GcInput value={nextFolder} onChange={(event) => setNextFolder(event.target.value)} placeholder="homepage/banners" />
            <p style={{ marginTop: 6, fontSize: 11.5, color: C.tx3 }}>Path relatif di dalam root terpilih. Kosongkan untuk simpan langsung di root.</p>
          </div>

          <div>
            <GcFieldLabel>Replace Image</GcFieldLabel>
            <input type="file" accept="image/*" onChange={(event) => setReplacement(event.target.files?.[0] ?? null)} style={{ width: "100%", fontFamily: font, fontSize: 13 }} />
            <p style={{ marginTop: 6, fontSize: 11.5, color: C.tx3 }}>Opsional. Jika dipilih, file lama akan diganti dengan image baru.</p>
          </div>
        </div>

        {error ? <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 12.5 }}>{error}</div> : null}
      </div>
    </GcModalShell>
  );
}

function DeleteConfirmModal({
  type,
  label,
  onClose,
  onConfirm,
}: {
  type: "asset" | "folder";
  label: string;
  onClose: () => void;
  onConfirm: (payload: { confirmName: string; acknowledged: boolean }) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  // User must type 'delete' (case-insensitive) and check confirmation
  const canDelete = confirmPhrase.trim().toLowerCase() === "delete" && acknowledged;

  async function handleConfirm() {
    if (!canDelete) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm({ confirmName: confirmPhrase, acknowledged });
      onClose();
    } catch (err: any) {
      setError(err.message ?? `Failed to delete ${type}.`);
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      eyebrow="Double Confirmation"
      title={type === "folder" ? "Delete Folder?" : "Delete Asset?"}
      description={
        type === "folder"
          ? <>Folder <strong>{label}</strong> dan seluruh isinya akan dihapus permanen. Ketik <strong>delete</strong> lalu centang konfirmasi.</>
          : <>Asset <strong>{label}</strong> akan dihapus permanen dari Firebase Storage. Ketik <strong>delete</strong> lalu centang konfirmasi.</>
      }
      maxWidth={500}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="danger" size="lg" onClick={handleConfirm} loading={loading} disabled={!canDelete}>Delete Permanently</GcButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <GcFieldLabel required>Type 'delete' to confirm</GcFieldLabel>
          <GcInput value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} placeholder="delete" />
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 12.5, color: C.tx2, fontFamily: font }}>
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} style={{ marginTop: 2 }} />
          <span>Saya paham bahwa proses ini tidak bisa di-undo.</span>
        </label>
        {error ? <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 12.5 }}>{error}</div> : null}
      </div>
    </GcModalShell>
  );
}

function BulkMoveModal({
  count,
  availableRoots,
  currentRoot,
  currentFolder,
  onClose,
  onConfirm,
}: {
  count: number;
  availableRoots: RootRecord[];
  currentRoot: string;
  currentFolder: string;
  onClose: () => void;
  onConfirm: (payload: { nextRoot: string; nextFolder: string }) => Promise<void>;
}) {
  const [nextRoot, setNextRoot] = useState(currentRoot);
  const [nextFolder, setNextFolder] = useState(currentFolder);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      await onConfirm({ nextRoot, nextFolder: nextFolder.trim() });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to move selected assets.");
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      eyebrow="Bulk Move"
      title={`Move ${count} Selected Assets`}
      description="Pindahkan semua asset terpilih ke root atau folder lain dalam satu aksi."
      maxWidth={520}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="primary" size="lg" onClick={handleSubmit} loading={loading}>Move Assets</GcButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <GcFieldLabel>Target Root</GcFieldLabel>
          <GcSelect value={nextRoot} onChange={(event) => setNextRoot(event.target.value)}>
            {availableRoots.map((root) => <option key={root.name} value={root.name}>{root.name}</option>)}
          </GcSelect>
        </div>
        <div>
          <GcFieldLabel>Target Folder</GcFieldLabel>
          <GcInput value={nextFolder} onChange={(event) => setNextFolder(event.target.value)} placeholder="homepage/banners" />
          <p style={{ marginTop: 6, fontSize: 11.5, color: C.tx3 }}>Kosongkan jika ingin pindah langsung ke root terpilih.</p>
        </div>
        {error ? <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 12.5 }}>{error}</div> : null}
      </div>
    </GcModalShell>
  );
}

function BulkDeleteModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (payload: { confirmPhrase: string; acknowledged: boolean }) => Promise<void>;
}) {
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const expectedPhrase = `DELETE ${count}`;
  const canDelete = confirmPhrase.trim() === expectedPhrase && acknowledged;

  async function handleSubmit() {
    if (!canDelete) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm({ confirmPhrase, acknowledged });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete selected assets.");
      setLoading(false);
    }
  }

  return (
    <GcModalShell
      onClose={onClose}
      eyebrow="Bulk Delete"
      title={`Delete ${count} Selected Assets?`}
      description={<>Ketik <strong>{expectedPhrase}</strong> lalu centang konfirmasi untuk mencegah salah hapus.</>}
      maxWidth={520}
      footer={
        <>
          <GcButton variant="ghost" size="lg" onClick={onClose}>Cancel</GcButton>
          <GcButton variant="danger" size="lg" onClick={handleSubmit} loading={loading} disabled={!canDelete}>Delete Selected</GcButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <GcFieldLabel required>Confirmation Phrase</GcFieldLabel>
          <GcInput value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} placeholder={expectedPhrase} />
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 12.5, color: C.tx2, fontFamily: font }}>
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} style={{ marginTop: 2 }} />
          <span>Saya paham bahwa semua asset terpilih akan dihapus permanen.</span>
        </label>
        {error ? <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 12.5 }}>{error}</div> : null}
      </div>
    </GcModalShell>
  );
}

export default function AssetsClient() {
  const [listing, setListing] = useState<AssetListing>(EMPTY_LISTING);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<AssetFolder | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<AssetFolder | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<AssetItem | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedAssetPaths, setSelectedAssetPaths] = useState<string[]>([]);
  const [assetRenderLimit, setAssetRenderLimit] = useState(24);
  const [search, setSearch] = useState("");

  const loadListing = useCallback(async (root = EMPTY_LISTING.currentRoot, folder = "") => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (root) params.set("root", root);
      if (folder) params.set("folder", folder);
      const response = await fetch(`/api/assets?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to load asset gallery.");
      }

      setUnauthorized(false);
      setListing(data as AssetListing);
      setSelectedAssetPaths([]);
      setAssetRenderLimit(24);
    } catch (err: any) {
      setError(err.message ?? "Failed to load asset gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListing(EMPTY_LISTING.currentRoot, "");
  }, [loadListing]);

  useEffect(() => {
    setAssetRenderLimit(24);
  }, [search]);

  const visibleFolders = useMemo(() => {
    if (!search.trim()) return listing.folders;
    return listing.folders.filter((folder) => folder.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [listing.folders, search]);

  const visibleAssets = useMemo(() => {
    if (!search.trim()) return listing.assets;
    return listing.assets.filter((asset) => asset.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [listing.assets, search]);
  const galleryPreviewFrame = useMemo(() => getPreviewFrame(listing.currentRoot), [listing.currentRoot]);

  const renderedAssets = useMemo(
    () => visibleAssets.slice(0, assetRenderLimit),
    [visibleAssets, assetRenderLimit]
  );

  const hasMoreAssets = renderedAssets.length < visibleAssets.length;
  const selectedAssetSet = useMemo(() => new Set(selectedAssetPaths), [selectedAssetPaths]);
  const selectedAssets = useMemo(
    () => listing.assets.filter((asset) => selectedAssetSet.has(asset.fullPath)),
    [listing.assets, selectedAssetSet]
  );

  async function withSubmit(action: () => Promise<void>) {
    setSubmitting(true);
    try {
      await action();
    } finally {
      setSubmitting(false);
    }
  }

  async function createFolder(folderName: string) {
    await withSubmit(async () => {
      const response = await fetch("/api/assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-folder",
          root: listing.currentRoot,
          parentFolder: listing.currentFolder,
          folderName,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Failed to create folder.");

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({ msg: "Folder created successfully.", type: "success" });
    });
  }

  async function uploadAssets(payload: { files: File[]; fileName?: string }) {
    await withSubmit(async () => {
      for (let index = 0; index < payload.files.length; index += 1) {
        const file = payload.files[index];
        const formData = new FormData();
        formData.set("action", "upload");
        formData.set("root", listing.currentRoot);
        formData.set("folder", listing.currentFolder);
        formData.set("file", file);
        if (payload.fileName && payload.files.length === 1) {
          formData.set("fileName", payload.fileName);
        }

        const response = await fetch("/api/assets", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message ?? `Failed to upload "${file.name}".`);
        }
      }

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({
        msg: payload.files.length > 1 ? `${payload.files.length} images uploaded successfully.` : "Asset uploaded successfully.",
        type: "success",
      });
    });
  }

  async function renameFolder(payload: { sourcePath: string; nextRoot: string; nextParentFolder: string; nextName: string }) {
    await withSubmit(async () => {
      const response = await fetch("/api/assets", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename-folder",
          sourcePath: payload.sourcePath,
          nextRoot: payload.nextRoot,
          nextParentFolder: payload.nextParentFolder,
          nextName: payload.nextName,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Failed to rename folder.");

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({ msg: "Folder updated successfully.", type: "success" });
    });
  }

  async function saveAsset(payload: { assetPath: string; nextRoot: string; nextName: string; nextFolder: string; file: File | null }) {
    await withSubmit(async () => {
      const formData = new FormData();
      formData.set("assetPath", payload.assetPath);
      formData.set("nextRoot", payload.nextRoot);
      formData.set("nextName", payload.nextName);
      formData.set("nextFolder", payload.nextFolder);
      if (payload.file) formData.set("file", payload.file);

      const response = await fetch("/api/assets", {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Failed to update asset.");

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({ msg: "Asset updated successfully.", type: "success" });
    });
  }

  async function deleteFolder(folder: AssetFolder, payload: { confirmName: string; acknowledged: boolean }) {
    await withSubmit(async () => {
      const response = await fetch("/api/assets", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "folder",
          path: folder.fullPath,
          confirmName: payload.confirmName,
          acknowledged: payload.acknowledged,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Failed to delete folder.");

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({ msg: `Folder "${folder.name}" deleted.`, type: "success" });
    });
  }

  async function deleteAsset(asset: AssetItem, payload: { confirmName: string; acknowledged: boolean }) {
    await withSubmit(async () => {
      const response = await fetch("/api/assets", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "asset",
          path: asset.fullPath,
          confirmName: payload.confirmName,
          acknowledged: payload.acknowledged,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Failed to delete asset.");

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({ msg: `Asset "${asset.name}" deleted.`, type: "success" });
    });
  }

  async function copyUrl(asset: AssetItem) {
    try {
      await navigator.clipboard.writeText(asset.url);
      setToast({ msg: `URL copied for "${asset.name}".`, type: "success" });
    } catch {
      setToast({ msg: "Failed to copy asset URL.", type: "error" });
    }
  }

  function toggleAssetSelection(fullPath: string) {
    setSelectedAssetPaths((current) =>
      current.includes(fullPath)
        ? current.filter((path) => path !== fullPath)
        : [...current, fullPath]
    );
  }

  function selectRenderedAssets() {
    setSelectedAssetPaths(Array.from(new Set(renderedAssets.map((asset) => asset.fullPath))));
  }

  function clearAssetSelection() {
    setSelectedAssetPaths([]);
  }

  async function bulkMoveSelected(payload: { nextRoot: string; nextFolder: string }) {
    await withSubmit(async () => {
      const response = await fetch("/api/assets", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move-assets",
          paths: selectedAssetPaths,
          nextRoot: payload.nextRoot,
          nextFolder: payload.nextFolder,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Failed to move selected assets.");

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({ msg: `${selectedAssetPaths.length} assets moved successfully.`, type: "success" });
    });
  }

  async function bulkDeleteSelected(payload: { confirmPhrase: string; acknowledged: boolean }) {
    await withSubmit(async () => {
      const response = await fetch("/api/assets", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "assets",
          paths: selectedAssetPaths,
          confirmPhrase: payload.confirmPhrase,
          acknowledged: payload.acknowledged,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Failed to delete selected assets.");

      await loadListing(listing.currentRoot, listing.currentFolder);
      setToast({ msg: `${selectedAssetPaths.length} assets deleted.`, type: "success" });
    });
  }

  if (unauthorized) {
    return <UnauthorizedOverlay />;
  }

  return (
    <GcPage maxWidth={1440}>
      <GcPageHeader
        eyebrow="Gongcha App Admin"
        title="Asset Library"
        description="Manage image assets for the 'products' and 'rewards' storage roots. The asset grid now supports lazy loading, and bulk move/delete operations are enabled."
        meta={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: C.blueL, color: C.blue, fontSize: 11.5, fontWeight: 700 }}>
              {listing.folders.length} folders
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: C.greenBg, color: C.green, fontSize: 11.5, fontWeight: 700 }}>
              {listing.assets.length} assets
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: C.orangeBg, color: C.orange, fontSize: 11.5, fontWeight: 700 }}>
              Root: /{listing.currentRoot}
            </span>
          </div>
        }
        actions={
          <>
            <GcButton variant="ghost" size="lg" onClick={() => void loadListing(listing.currentRoot, listing.currentFolder)} disabled={loading || submitting}>Refresh</GcButton>
            <GcButton variant="secondary" size="lg" onClick={() => setCreateFolderOpen(true)} disabled={loading || submitting}>New Folder</GcButton>
            <GcButton variant="primary" size="lg" onClick={() => setUploadOpen(true)} disabled={loading || submitting}>Upload Images</GcButton>
          </>
        }
      />

      <GcPanel style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {listing.availableRoots.map((root) => {
              const active = root.name === listing.currentRoot;
              return (
                <button
                  key={root.name}
                  onClick={() => void loadListing(root.name, "")}
                  style={{
                    border: active ? "none" : `1px solid ${C.border}`,
                    background: active ? "linear-gradient(135deg,#059669,#047857)" : "#FFFFFF",
                    color: active ? "#FFFFFF" : C.tx2,
                    height: 38,
                    padding: "0 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: font,
                    fontSize: 12.5,
                    fontWeight: 700,
                    boxShadow: active ? "0 10px 22px rgba(5,150,105,.18)" : "none",
                  }}
                >
                  /{root.name}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {listing.breadcrumb.map((crumb, index) => (
                  <button
                    key={`${crumb.path || "root"}-${index}`}
                    onClick={() => void loadListing(listing.currentRoot, crumb.path)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: font,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: index === listing.breadcrumb.length - 1 ? C.tx1 : C.blue,
                    }}
                  >
                    {index > 0 ? " / " : ""}
                    {crumb.label}
                  </button>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: C.tx3 }}>Current folder: {folderLabel(listing.currentRoot, listing.currentFolder)}</p>
            </div>

            <div style={{ minWidth: 260, flex: "1 1 280px", maxWidth: 360 }}>
              <GcInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari folder atau asset..." />
            </div>
          </div>
        </div>
      </GcPanel>

      {loading ? (
        <LoadingPanel />
      ) : error ? (
        <GcPanel style={{ padding: 22 }}>
          <div style={{ padding: "14px 16px", borderRadius: 14, background: C.redBg, border: `1px solid #FECACA`, color: "#B42318", fontSize: 13.5, fontWeight: 600 }}>
            {error}
          </div>
        </GcPanel>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          <GcPanel style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.tx3, letterSpacing: ".12em", textTransform: "uppercase" }}>Folders</p>
                <h2 style={{ margin: "5px 0 0", fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", color: C.tx1 }}>Subfolders in {folderLabel(listing.currentRoot, listing.currentFolder)}</h2>
              </div>
            </div>

            {visibleFolders.length === 0 ? (
              <GcEmptyState title="No folders here" description="Buat folder baru atau pindah ke root lain untuk melihat struktur storage." icon="🗂️" style={{ padding: "40px 18px" }} />
            ) : (
              <div className="gc-grid-4">
                {visibleFolders.map((folder) => (
                  <div key={folder.fullPath} style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: "#FFFFFF", boxShadow: C.shadow, padding: 18 }}>
                    <button
                      onClick={() => void loadListing(folder.root, folder.path)}
                      style={{ border: "none", background: "transparent", padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ width: 46, height: 46, borderRadius: 14, background: C.blueL, color: C.blue, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                          <path d="M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v8A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-10z" />
                        </svg>
                      </div>
                      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: C.tx1, lineHeight: 1.3 }}>{folder.name}</p>
                      <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.tx3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        /{folder.fullPath}
                      </p>
                    </button>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 16 }}>
                      <GcButton variant="ghost" size="sm" onClick={() => void loadListing(folder.root, folder.path)}>Open</GcButton>
                      <GcButton variant="secondary" size="sm" onClick={() => setRenamingFolder(folder)}>Rename</GcButton>
                      <GcButton variant="danger" size="sm" onClick={() => setDeletingFolder(folder)}>Delete</GcButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GcPanel>

          <GcPanel style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.tx3, letterSpacing: ".12em", textTransform: "uppercase" }}>Images</p>
                <h2 style={{ margin: "5px 0 0", fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", color: C.tx1 }}>Asset Preview Grid</h2>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: C.tx3 }}>
                {renderedAssets.length} loaded of {visibleAssets.length} matching assets
              </p>
            </div>

            {selectedAssetPaths.length > 0 ? (
              <div style={{ marginBottom: 16, padding: 14, borderRadius: 16, border: `1px solid ${C.border}`, background: "#F8FAFC", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.tx3, letterSpacing: ".12em", textTransform: "uppercase" }}>Bulk Selection</p>
                  <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 800, color: C.tx1 }}>{selectedAssetPaths.length} assets selected</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GcButton variant="ghost" size="sm" onClick={clearAssetSelection}>Clear</GcButton>
                  <GcButton variant="secondary" size="sm" onClick={() => setBulkMoveOpen(true)}>Bulk Move</GcButton>
                  <GcButton variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>Bulk Delete</GcButton>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 12, color: C.tx3 }}>Pilih asset dari grid untuk bulk move atau bulk delete.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GcButton variant="ghost" size="sm" onClick={selectRenderedAssets} disabled={renderedAssets.length === 0}>Select Loaded</GcButton>
                </div>
              </div>
            )}

            {visibleAssets.length === 0 ? (
              <GcEmptyState title="No image assets in this folder" description="Upload image pertama ke folder ini atau pindah ke folder lain." icon="🖼️" style={{ padding: "44px 18px" }} />
            ) : (
              <>
                <div className="gc-grid-4">
                  {renderedAssets.map((asset) => (
                  (() => {
                    const rootBadge = getRootBadgeStyle(asset.root);
                    return (
                  <div key={asset.fullPath} style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: "#FFFFFF", boxShadow: C.shadow, overflow: "hidden" }}>
                    <div style={{ position: "relative", aspectRatio: galleryPreviewFrame.aspectRatio, background: galleryPreviewFrame.frameBackground, overflow: "hidden", padding: galleryPreviewFrame.padding, boxSizing: "border-box" }}>
                      <div style={{ width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: galleryPreviewFrame.surfaceBackground, boxShadow: galleryPreviewFrame.surfaceShadow }}>
                        <img src={asset.url} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: galleryPreviewFrame.fit, display: "block" }} />
                      </div>
                      <button
                        onClick={() => toggleAssetSelection(asset.fullPath)}
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          border: selectedAssetSet.has(asset.fullPath) ? "none" : "1px solid rgba(255,255,255,.75)",
                          background: selectedAssetSet.has(asset.fullPath) ? "linear-gradient(135deg,#059669,#047857)" : "rgba(255,255,255,.92)",
                          color: selectedAssetSet.has(asset.fullPath) ? "#FFFFFF" : C.tx2,
                          boxShadow: "0 8px 18px rgba(15,17,23,.12)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {selectedAssetSet.has(asset.fullPath) ? "✓" : ""}
                      </button>
                    </div>
                    <div style={{ padding: 16 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.tx1, lineHeight: 1.35, wordBreak: "break-word" }}>{asset.name}</p>
                      <div style={{ display: "grid", gap: 5, marginTop: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: C.tx3 }}>Root</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", background: rootBadge.background, border: rootBadge.border, color: rootBadge.color }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: rootBadge.dot, flexShrink: 0 }} />
                            {rootBadge.label}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: C.tx3 }}>Folder: {asset.folderPath || "(root)"}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: C.tx3 }}>Size: {formatBytes(asset.sizeBytes)}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: C.tx3 }}>Updated: {formatDate(asset.updatedAt)}</p>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
                        <GcButton variant="ghost" size="sm" onClick={() => void copyUrl(asset)}>Copy URL</GcButton>
                        <GcButton variant="secondary" size="sm" onClick={() => setEditingAsset(asset)}>Edit</GcButton>
                        <GcButton variant="ghost" size="sm" onClick={() => window.open(asset.url, "_blank", "noopener,noreferrer")}>Open</GcButton>
                        <GcButton variant="danger" size="sm" onClick={() => setDeletingAsset(asset)}>Delete</GcButton>
                      </div>
                    </div>
                  </div>
                    );
                  })()
                  ))}
                </div>

                {hasMoreAssets ? (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
                    <GcButton variant="ghost" size="lg" onClick={() => setAssetRenderLimit((count) => count + 24)}>
                      Load 24 More
                    </GcButton>
                  </div>
                ) : null}
              </>
            )}
          </GcPanel>
        </div>
      )}

      {createFolderOpen ? (
        <CreateFolderModal
          currentRoot={listing.currentRoot}
          currentFolder={listing.currentFolder}
          onClose={() => !submitting && setCreateFolderOpen(false)}
          onCreated={createFolder}
        />
      ) : null}

      {uploadOpen ? (
        <UploadAssetModal
          currentRoot={listing.currentRoot}
          currentFolder={listing.currentFolder}
          onClose={() => !submitting && setUploadOpen(false)}
          onUploaded={uploadAssets}
        />
      ) : null}

      {renamingFolder ? (
        <RenameFolderModal
          folder={renamingFolder}
          availableRoots={listing.availableRoots}
          onClose={() => !submitting && setRenamingFolder(null)}
          onSaved={renameFolder}
        />
      ) : null}

      {editingAsset ? (
        <EditAssetModal
          asset={editingAsset}
          availableRoots={listing.availableRoots}
          onClose={() => !submitting && setEditingAsset(null)}
          onSaved={saveAsset}
        />
      ) : null}

      {bulkMoveOpen ? (
        <BulkMoveModal
          count={selectedAssetPaths.length}
          availableRoots={listing.availableRoots}
          currentRoot={listing.currentRoot}
          currentFolder={listing.currentFolder}
          onClose={() => !submitting && setBulkMoveOpen(false)}
          onConfirm={bulkMoveSelected}
        />
      ) : null}

      {deletingFolder ? (
        <DeleteConfirmModal
          type="folder"
          label={deletingFolder.name}
          onClose={() => !submitting && setDeletingFolder(null)}
          onConfirm={(payload) => deleteFolder(deletingFolder, payload)}
        />
      ) : null}

      {deletingAsset ? (
        <DeleteConfirmModal
          type="asset"
          label={deletingAsset.name}
          onClose={() => !submitting && setDeletingAsset(null)}
          onConfirm={(payload) => deleteAsset(deletingAsset, payload)}
        />
      ) : null}

      {bulkDeleteOpen ? (
        <BulkDeleteModal
          count={selectedAssetPaths.length}
          onClose={() => !submitting && setBulkDeleteOpen(false)}
          onConfirm={bulkDeleteSelected}
        />
      ) : null}

      {toast ? <Toast toast={toast} onDone={() => setToast(null)} /> : null}
    </GcPage>
  );
}
