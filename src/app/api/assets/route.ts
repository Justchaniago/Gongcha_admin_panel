import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStorage } from "firebase-admin/storage";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ROOT = "products";
const KNOWN_ROOTS = ["products", "rewards"] as const;
const SIGNED_URL_TTL_MS = 1000 * 60 * 60;

type RootRecord = {
  name: string;
};

type BreadcrumbRecord = {
  label: string;
  path: string;
};

type AssetRecord = {
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

type FolderRecord = {
  root: string;
  name: string;
  path: string;
  fullPath: string;
};

function getBucket() {
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.FIREBASE_STORAGE_BUCKET?.trim();

  if (!bucketName) {
    throw new Error("Firebase Storage bucket is not configured. Please check your environment settings.");
  }

  return getStorage().bucket(bucketName);
}

async function validateSuperAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return { error: "Session not found. Please log in again.", status: 401 as const, uid: null };
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const profileSnap = await adminDb.collection("admin_users").doc(decoded.uid).get();
    const profile = profileSnap.data();

    if (profile?.isActive !== true) {
      return { error: "Access denied. Your account is inactive.", status: 403 as const, uid: null };
    }

    if (profile?.role !== "SUPER_ADMIN") {
      return { error: "Access denied. SUPER_ADMIN privileges are required.", status: 403 as const, uid: null };
    }

    return { error: null, status: 200 as const, uid: decoded.uid };
  } catch {
    return { error: "Invalid session. Please log in again.", status: 401 as const, uid: null };
  }
}

function normalizeInputPath(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

function rejectTraversal(path: string) {
  if (path.split("/").includes("..")) {
    throw new Error("Invalid path. Path traversal is not allowed.");
  }
}

function sanitizeRootName(raw: unknown) {
  const normalized = String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

  if (!normalized) {
    throw new Error("Root name is required for this operation.");
  }

  return normalized;
}

function sanitizeFolderName(raw: unknown) {
  const normalized = String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  if (!normalized) {
    throw new Error("Folder name is required for this operation.");
  }

  return normalized;
}

function sanitizeFileName(raw: unknown) {
  const input = String(raw ?? "").trim();
  if (!input) throw new Error("File name is required for this operation.");

  const extIndex = input.lastIndexOf(".");
  const rawBase = extIndex > 0 ? input.slice(0, extIndex) : input;
  const rawExt = extIndex > 0 ? input.slice(extIndex + 1) : "";

  const base = rawBase
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  const ext = rawExt
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!base) throw new Error("File name is invalid. Please check your input.");
  return ext ? `${base}.${ext}` : base;
}

function resolveRoot(raw: unknown, fallback = DEFAULT_ROOT) {
  const normalized = normalizeInputPath(raw);
  if (!normalized) return fallback;
  rejectTraversal(normalized);
  if (normalized.includes("/")) {
    throw new Error("Root must be a top-level folder. Nested roots are not permitted.");
  }
  const root = sanitizeRootName(normalized);
  if (!KNOWN_ROOTS.includes(root as (typeof KNOWN_ROOTS)[number])) {
    throw new Error(`Unsupported storage root "${root}". Please use a valid root name.`);
  }
  return root;
}

function resolveFolderWithinRoot(root: string, raw: unknown) {
  const normalized = normalizeInputPath(raw);
  if (!normalized || normalized === root) return "";
  rejectTraversal(normalized);
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

function composeFolderPath(root: string, relativeFolder = "") {
  return relativeFolder ? `${root}/${relativeFolder}` : root;
}

function joinPath(folderPath: string, segment: string) {
  return `${folderPath}/${segment}`;
}

function getFileName(path: string) {
  return path.split("/").pop() ?? path;
}

function getRootName(path: string) {
  return path.split("/")[0] ?? path;
}

function getParentFolder(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function toRelativeWithinRoot(root: string, fullPath: string) {
  if (fullPath === root) return "";
  return fullPath.startsWith(`${root}/`) ? fullPath.slice(root.length + 1) : fullPath;
}

function isPlaceholderFile(path: string) {
  return getFileName(path) === ".keep";
}

function isImageFile(contentType: string | null | undefined, path: string) {
  if (contentType?.startsWith("image/")) return true;
  const lower = path.toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"].some((ext) => lower.endsWith(ext));
}

function resolveAssetPath(raw: unknown) {
  const normalized = normalizeInputPath(raw);
  if (!normalized) throw new Error("Asset path is required for this operation.");
  rejectTraversal(normalized);
  if (!normalized.includes("/")) {
    throw new Error("Asset path must include the root folder. Please check your input.");
  }
  return normalized;
}

function resolveFolderPath(raw: unknown) {
  const normalized = normalizeInputPath(raw);
  if (!normalized) throw new Error("Folder path is required for this operation.");
  rejectTraversal(normalized);
  return normalized;
}

async function getAvailableRoots() {
  return [...KNOWN_ROOTS].map((name) => ({ name }));
}

async function buildAssetRecord(file: any): Promise<AssetRecord> {
  const [metadata] = await file.getMetadata();
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });

  const fullPath = String(metadata.name ?? file.name ?? "");
  const root = getRootName(fullPath);
  const fullFolderPath = getParentFolder(fullPath);

  return {
    root,
    name: getFileName(fullPath),
    path: toRelativeWithinRoot(root, fullPath),
    fullPath,
    folderPath: toRelativeWithinRoot(root, fullFolderPath),
    fullFolderPath,
    sizeBytes: Number(metadata.size ?? 0),
    updatedAt: metadata.updated ?? metadata.timeCreated ?? null,
    contentType: metadata.contentType ?? null,
    url,
  };
}

async function ensureUniqueFilePath(bucket: ReturnType<typeof getBucket>, folderPath: string, fileName: string) {
  const extIndex = fileName.lastIndexOf(".");
  const base = extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
  const ext = extIndex > 0 ? fileName.slice(extIndex) : "";

  let counter = 0;
  let candidate = joinPath(folderPath, fileName);

  while (true) {
    const [exists] = await bucket.file(candidate).exists();
    if (!exists) return candidate;
    counter += 1;
    candidate = joinPath(folderPath, `${base}-${counter}${ext}`);
  }
}

async function listFolder(root: string, relativeFolder: string) {
  const bucket = getBucket();
  const fullFolderPath = composeFolderPath(root, relativeFolder);
  const prefix = `${fullFolderPath}/`;
  const [files, , apiResponse] = await bucket.getFiles({ prefix, delimiter: "/" });
  const availableRoots = await getAvailableRoots();
  const prefixes = Array.isArray((apiResponse as { prefixes?: string[] } | undefined)?.prefixes)
    ? ((apiResponse as { prefixes?: string[] }).prefixes ?? [])
    : [];

  const folders: FolderRecord[] = prefixes
    .map((entry: string) => String(entry).replace(/\/$/, ""))
    .filter(Boolean)
    .map((fullPath: string) => ({
      root,
      name: getFileName(fullPath),
      path: toRelativeWithinRoot(root, fullPath),
      fullPath,
    }))
    .sort((a: FolderRecord, b: FolderRecord) => a.name.localeCompare(b.name));

  const imageFiles = files.filter((file) => {
    const fullPath = String(file.name ?? "");
    const contentType = file.metadata?.contentType ?? null;
    return !isPlaceholderFile(fullPath) && isImageFile(contentType, fullPath);
  });

  const assets = await Promise.all(imageFiles.map((file) => buildAssetRecord(file)));
  assets.sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });

  const breadcrumb: BreadcrumbRecord[] = [
    { label: root, path: "" },
    ...relativeFolder
      .split("/")
      .filter(Boolean)
      .map((segment, index, parts) => ({
        label: segment,
        path: parts.slice(0, index + 1).join("/"),
      })),
  ];

  return {
    availableRoots,
    currentRoot: root,
    currentFolder: relativeFolder,
    currentFullPath: fullFolderPath,
    currentFolderName: getFileName(fullFolderPath),
    breadcrumb,
    folders,
    assets,
  };
}

async function parseJsonBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function moveFolder({
  bucket,
  sourceFolderPath,
  targetFolderPath,
}: {
  bucket: ReturnType<typeof getBucket>;
  sourceFolderPath: string;
  targetFolderPath: string;
}) {
  if (sourceFolderPath === targetFolderPath) {
    return;
  }

  if (targetFolderPath.startsWith(`${sourceFolderPath}/`)) {
    throw new Error("A folder cannot be moved into its own subfolder.");
  }

  const [files] = await bucket.getFiles({ prefix: `${sourceFolderPath}/` });
  if (files.length === 0) {
    throw new Error("The specified folder was not found.");
  }

  for (const file of files) {
    const suffix = file.name.slice(sourceFolderPath.length + 1);
    const destination = `${targetFolderPath}/${suffix}`;
    const [exists] = await bucket.file(destination).exists();
    if (exists) {
      throw new Error(`Target already contains "${destination}".`);
    }
  }

  for (const file of files) {
    const suffix = file.name.slice(sourceFolderPath.length + 1);
    const destination = `${targetFolderPath}/${suffix}`;
    await file.copy(bucket.file(destination));
  }

  for (const file of files) {
    await file.delete({ ignoreNotFound: true });
  }
}

async function moveAssets({
  bucket,
  sourcePaths,
  targetRoot,
  targetFolder,
}: {
  bucket: ReturnType<typeof getBucket>;
  sourcePaths: string[];
  targetRoot: string;
  targetFolder: string;
}) {
  const uniqueSourcePaths = Array.from(new Set(sourcePaths));
  if (uniqueSourcePaths.length === 0) {
    throw new Error("No assets were selected for this operation.");
  }

  const targetFolderPath = composeFolderPath(targetRoot, targetFolder);
  const targetPathMap = new Map<string, string>();

  for (const sourcePath of uniqueSourcePaths) {
    const targetPath = joinPath(targetFolderPath, getFileName(sourcePath));
    if (targetPathMap.has(targetPath)) {
      throw new Error(`Duplicate target filename "${getFileName(sourcePath)}" detected in bulk move selection.`);
    }
    targetPathMap.set(targetPath, sourcePath);
  }

  for (const [targetPath, sourcePath] of targetPathMap.entries()) {
    if (targetPath === sourcePath) continue;
    const [targetExists] = await bucket.file(targetPath).exists();
    if (targetExists) {
      throw new Error(`An asset with this name already exists in the target folder: ${targetPath}`);
    }
  }

  for (const [targetPath, sourcePath] of targetPathMap.entries()) {
    if (targetPath === sourcePath) continue;
    const sourceFile = bucket.file(sourcePath);
    const [sourceExists] = await sourceFile.exists();
    if (!sourceExists) {
      throw new Error(`Asset not found: ${sourcePath}. Please check your selection.`);
    }

    await sourceFile.copy(bucket.file(targetPath));
    await sourceFile.delete({ ignoreNotFound: true });
  }
}

export async function GET(req: NextRequest) {
  const auth = await validateSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ message: auth.error }, { status: auth.status });
  }

  try {
    const root = resolveRoot(req.nextUrl.searchParams.get("root"));
    const folder = resolveFolderWithinRoot(root, req.nextUrl.searchParams.get("folder"));
    const payload = await listFolder(root, folder);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[GET /api/assets]", error);
    return NextResponse.json({ message: error.message ?? "Unable to load asset gallery. Please try again later." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ message: auth.error }, { status: auth.status });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const bucket = getBucket();

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = String(formData.get("action") ?? "upload");

      if (action !== "upload") {
        return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
      }

      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ message: "An image file is required for this operation." }, { status: 400 });
      }

      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ message: "Only image files are permitted for upload." }, { status: 400 });
      }

      const root = resolveRoot(formData.get("root"));
      const folder = resolveFolderWithinRoot(root, formData.get("folder"));
      const fullFolderPath = composeFolderPath(root, folder);
      const requestedFileName = String(formData.get("fileName") ?? "").trim();
      const safeFileName = sanitizeFileName(requestedFileName || file.name || `asset-${Date.now()}`);
      const fullPath = await ensureUniqueFilePath(bucket, fullFolderPath, safeFileName);
      const buffer = Buffer.from(await file.arrayBuffer());

      await bucket.file(fullPath).save(buffer, {
        resumable: false,
        contentType: file.type || undefined,
        metadata: {
          contentType: file.type || undefined,
          metadata: {
            uploadedBy: auth.uid ?? "unknown",
            originalName: file.name || safeFileName,
          },
        },
      });

      const asset = await buildAssetRecord(bucket.file(fullPath));
      return NextResponse.json({ message: "Asset uploaded successfully.", asset }, { status: 201 });
    }

    const body = await parseJsonBody(req);
    const action = String(body.action ?? "");

    if (action !== "create-folder") {
      return NextResponse.json({ message: "This action is not supported. Please check your request." }, { status: 400 });
    }

    const root = resolveRoot(body.root);
    const parentFolder = resolveFolderWithinRoot(root, body.parentFolder ?? body.folder);
    const folderName = sanitizeFolderName(body.folderName);
    const nextFolderPath = joinPath(composeFolderPath(root, parentFolder), folderName);
    const placeholder = bucket.file(`${nextFolderPath}/.keep`);
    const [existingFiles] = await bucket.getFiles({ prefix: `${nextFolderPath}/`, maxResults: 1 });
    const [exists] = await placeholder.exists();

    if (exists || existingFiles.length > 0) {
      return NextResponse.json({ message: `A folder named "${folderName}" already exists in this location.` }, { status: 409 });
    }

    await placeholder.save("", {
      resumable: false,
      contentType: "text/plain; charset=utf-8",
      metadata: {
        metadata: {
          createdBy: auth.uid ?? "unknown",
        },
      },
    });

    return NextResponse.json({
      message: "Folder created successfully.",
      folder: {
        root,
        name: folderName,
        path: toRelativeWithinRoot(root, nextFolderPath),
        fullPath: nextFolderPath,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/assets]", error);
    return NextResponse.json({ message: error.message ?? "Unable to create asset. Please try again later." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await validateSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ message: auth.error }, { status: auth.status });
  }

  try {
    const bucket = getBucket();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const sourcePath = resolveAssetPath(formData.get("assetPath"));
      const replacementFile = formData.get("file");
      const sourceRoot = getRootName(sourcePath);
      const currentFolder = toRelativeWithinRoot(sourceRoot, getParentFolder(sourcePath));
      const targetRoot = formData.get("nextRoot") !== null ? resolveRoot(formData.get("nextRoot"), sourceRoot) : sourceRoot;
      const targetFolder = formData.get("nextFolder") !== null
        ? resolveFolderWithinRoot(targetRoot, formData.get("nextFolder"))
        : currentFolder;
      const requestedName = String(formData.get("nextName") ?? "").trim();
      const targetName = requestedName ? sanitizeFileName(requestedName) : getFileName(sourcePath);
      const targetFolderPath = composeFolderPath(targetRoot, targetFolder);
      const targetPath = joinPath(targetFolderPath, targetName);

      const sourceFile = bucket.file(sourcePath);
      const [sourceExists] = await sourceFile.exists();
      if (!sourceExists) {
        return NextResponse.json({ message: "Asset not found." }, { status: 404 });
      }

      if (replacementFile instanceof File) {
        if (!replacementFile.type.startsWith("image/")) {
          return NextResponse.json({ message: "Only image files are allowed." }, { status: 400 });
        }

        if (targetPath !== sourcePath) {
          const [targetExists] = await bucket.file(targetPath).exists();
          if (targetExists) {
            return NextResponse.json({ message: "Target asset name already exists in that folder." }, { status: 409 });
          }
        }

        const buffer = Buffer.from(await replacementFile.arrayBuffer());
        await bucket.file(targetPath).save(buffer, {
          resumable: false,
          contentType: replacementFile.type || undefined,
          metadata: {
            contentType: replacementFile.type || undefined,
            metadata: {
              updatedBy: auth.uid ?? "unknown",
              originalName: replacementFile.name || targetName,
            },
          },
        });

        if (targetPath !== sourcePath) {
          await sourceFile.delete({ ignoreNotFound: true });
        }

        const asset = await buildAssetRecord(bucket.file(targetPath));
        return NextResponse.json({ message: "Asset updated successfully.", asset });
      }

      if (targetPath === sourcePath) {
        const asset = await buildAssetRecord(sourceFile);
        return NextResponse.json({ message: "No changes detected.", asset });
      }

      const [targetExists] = await bucket.file(targetPath).exists();
      if (targetExists) {
        return NextResponse.json({ message: "Target asset name already exists in that folder." }, { status: 409 });
      }

      await sourceFile.copy(bucket.file(targetPath));
      await sourceFile.delete({ ignoreNotFound: true });

      const asset = await buildAssetRecord(bucket.file(targetPath));
      return NextResponse.json({ message: "Asset moved successfully.", asset });
    }

    const body = await parseJsonBody(req);
    const action = String(body.action ?? "");

    if (action === "rename-folder") {
      const sourceFolderPath = resolveFolderPath(body.sourcePath);
      if (!sourceFolderPath.includes("/")) {
        return NextResponse.json({ message: "Top-level root folder cannot be renamed." }, { status: 400 });
      }

      const sourceRoot = getRootName(sourceFolderPath);
      const sourceParent = getParentFolder(sourceFolderPath);
      const sourceParentRelative = toRelativeWithinRoot(sourceRoot, sourceParent);
      const targetRoot = body.nextRoot ? resolveRoot(body.nextRoot, sourceRoot) : sourceRoot;
      const targetParentRelative = body.nextParentFolder !== undefined
        ? resolveFolderWithinRoot(targetRoot, body.nextParentFolder)
        : sourceParentRelative;
      const targetName = sanitizeFolderName(body.nextName ?? getFileName(sourceFolderPath));
      const targetFolderPath = joinPath(composeFolderPath(targetRoot, targetParentRelative), targetName);

      await moveFolder({
        bucket,
        sourceFolderPath,
        targetFolderPath,
      });

      return NextResponse.json({
        message: "Folder renamed successfully.",
        folder: {
          root: targetRoot,
          name: targetName,
          path: toRelativeWithinRoot(targetRoot, targetFolderPath),
          fullPath: targetFolderPath,
        },
      });
    }

    if (action === "move-assets") {
      const sourcePaths: string[] = Array.isArray(body.paths)
        ? body.paths.map((entry: unknown) => resolveAssetPath(entry))
        : [];
      const targetRoot = resolveRoot(body.nextRoot);
      const targetFolder = resolveFolderWithinRoot(targetRoot, body.nextFolder);

      await moveAssets({
        bucket,
        sourcePaths,
        targetRoot,
        targetFolder,
      });

      return NextResponse.json({
        message: `${sourcePaths.length} asset${sourcePaths.length === 1 ? "" : "s"} moved successfully.`,
      });
    }

    return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
  } catch (error: any) {
    console.error("[PATCH /api/assets]", error);
    return NextResponse.json({ message: error.message ?? "Unable to update asset. Please try again later." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await validateSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ message: auth.error }, { status: auth.status });
  }

  try {
    const bucket = getBucket();
    const body = await parseJsonBody(req);
    const target = String(body.target ?? "");
    const confirmName = String(body.confirmName ?? "").trim();
    const acknowledged = body.acknowledged === true;

    if (!acknowledged) {
      return NextResponse.json({ message: "Delete confirmation is required." }, { status: 400 });
    }

    if (target === "asset") {
      const assetPath = resolveAssetPath(body.path);
      if (confirmName.toLowerCase() !== "delete") {
        return NextResponse.json({ message: "To confirm deletion, please type 'delete'." }, { status: 400 });
      }

      await bucket.file(assetPath).delete({ ignoreNotFound: true });
      return NextResponse.json({ message: "The asset has been deleted successfully." });
    }

    if (target === "folder") {
      const folderPath = resolveFolderPath(body.path ?? body.folder);
      if (!folderPath.includes("/")) {
        return NextResponse.json({ message: "Deleting the top-level root folder is not permitted." }, { status: 400 });
      }

      if (confirmName.toLowerCase() !== "delete") {
        return NextResponse.json({ message: "To confirm deletion, please type 'delete'." }, { status: 400 });
      }

      const [files] = await bucket.getFiles({ prefix: `${folderPath}/` });
      await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
      return NextResponse.json({ message: "The folder and its contents have been deleted successfully." });
    }

    if (target === "assets") {
      const assetPaths: string[] = Array.isArray(body.paths)
        ? body.paths.map((entry: unknown) => resolveAssetPath(entry))
        : [];
      const uniquePaths: string[] = Array.from(new Set(assetPaths));
      if (uniquePaths.length === 0) {
        return NextResponse.json({ message: "No assets were selected for this operation." }, { status: 400 });
      }

      const confirmPhrase = String(body.confirmPhrase ?? "").trim();
      if (confirmPhrase !== `DELETE ${uniquePaths.length}`) {
        return NextResponse.json({ message: `To confirm bulk deletion, please type DELETE ${uniquePaths.length}.` }, { status: 400 });
      }

      await Promise.all(uniquePaths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })));
      return NextResponse.json({ message: `${uniquePaths.length} assets have been deleted successfully.` });
    }

    return NextResponse.json({ message: "This delete target is not supported. Please check your request." }, { status: 400 });
  } catch (error: any) {
    console.error("[DELETE /api/assets]", error);
    return NextResponse.json({ message: error.message ?? "Unable to delete asset. Please try again later." }, { status: 500 });
  }
}
