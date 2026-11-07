import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  isFirebaseAuthorizedAdmin,
  OperationType,
  handleFirestoreError,
} from './firebase';
import {
  isCloudinaryPdfBridgeUrl,
  isCloudinaryUrl,
  setCachedDirectPdfAllowed,
} from '../utils/drive';

export type MediaCategory =
  | 'Profile'
  | 'Certificates'
  | 'Projects'
  | 'Events'
  | 'Resume'
  | 'Other';

export const MEDIA_CATEGORIES: MediaCategory[] = [
  'Profile',
  'Certificates',
  'Projects',
  'Events',
  'Resume',
  'Other',
];

export type MediaAcceptKind = 'image' | 'pdf' | 'both';

export interface MediaAsset {
  id: string;
  name: string;
  category: MediaCategory;
  downloadUrl: string;
  cloudinaryUrl?: string;
  publicViewUrl?: string;
  publicDownloadUrl?: string;
  publicId: string;
  cloudinaryResourceType?: 'image' | 'raw' | 'video';
  directPdfDelivery?: boolean;
  format?: string;
  storagePath?: string;
  mimeType: string;
  sizeBytes: number;
  status: 'draft' | 'published';
  linkedEntityType?: string;
  linkedEntityId?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadProgressInfo {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  state: 'running' | 'paused' | 'success' | 'error' | 'canceled';
}

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
  resolvedMimeType: string;
  isImage: boolean;
  isPdf: boolean;
}

export interface CloudinaryStatus {
  configured: boolean;
  cloudName: string | null;
  missing: string[];
  maxFileSizeBytes: number;
  allowedExtensions: string[];
  directPdfAllowed?: boolean | null;
}

export const MAX_MEDIA_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

function getBackendAuthHeaders(includeJsonContentType = true): Record<string, string> {
  const token = sessionStorage.getItem('admin_session_token');
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function formatFileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getAcceptAttribute(acceptKind: MediaAcceptKind): string {
  if (acceptKind === 'image') {
    return 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
  }
  if (acceptKind === 'pdf') {
    return 'application/pdf,.pdf';
  }
  return 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';
}

export function validateMediaFile(
  file: File,
  acceptKind: MediaAcceptKind = 'both'
): MediaValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'No file selected.',
      resolvedMimeType: '',
      isImage: false,
      isPdf: false,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'The selected file is empty (0 bytes). Please choose a valid file.',
      resolvedMimeType: file.type || '',
      isImage: false,
      isPdf: false,
    };
  }

  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 10 MB upload limit. Please compress or choose a smaller file.`,
      resolvedMimeType: file.type || '',
      isImage: false,
      isPdf: false,
    };
  }

  const lowerName = file.name.toLowerCase();
  const extMatch = lowerName.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : '';
  const mime = (file.type || '').toLowerCase();

  const isImage = ALLOWED_IMAGE_MIME_TYPES.has(mime) || ALLOWED_IMAGE_EXTENSIONS.has(ext);
  const isPdf = mime === 'application/pdf' || ext === '.pdf';

  let resolvedMimeType = '';
  if (mime === 'image/jpg' || mime === 'image/jpeg' || ext === '.jpg' || ext === '.jpeg') {
    resolvedMimeType = 'image/jpeg';
  } else if (mime === 'image/png' || ext === '.png') {
    resolvedMimeType = 'image/png';
  } else if (mime === 'image/webp' || ext === '.webp') {
    resolvedMimeType = 'image/webp';
  } else if (isPdf) {
    resolvedMimeType = 'application/pdf';
  }

  if (acceptKind === 'image' && !isImage) {
    return {
      valid: false,
      error: 'Unsupported file type. Allowed image formats: JPG, JPEG, PNG, and WEBP.',
      resolvedMimeType,
      isImage,
      isPdf,
    };
  }

  if (acceptKind === 'pdf' && !isPdf) {
    return {
      valid: false,
      error: 'Unsupported file type. Only PDF documents (.pdf) are allowed.',
      resolvedMimeType,
      isImage,
      isPdf,
    };
  }

  if (acceptKind === 'both' && !isImage && !isPdf) {
    return {
      valid: false,
      error: 'Unsupported file type. Allowed formats: JPG, JPEG, PNG, WEBP, and PDF.',
      resolvedMimeType,
      isImage,
      isPdf,
    };
  }

  return {
    valid: true,
    resolvedMimeType,
    isImage,
    isPdf,
  };
}

/**
 * Checks whether Cloudinary server secrets (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
 * are configured via protected backend endpoint.
 */
export async function getCloudinaryStatus(): Promise<CloudinaryStatus> {
  const res = await fetch('/api/admin/cloudinary/status', {
    method: 'GET',
    headers: getBackendAuthHeaders(false),
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new Error('Admin session expired or missing. Please sign in to the Admin Panel again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed checking Cloudinary configuration.' }));
    throw new Error(err.error || 'Failed checking Cloudinary configuration.');
  }

  return res.json();
}

function buildCleanMediaDoc(asset: MediaAsset): Record<string, any> {
  const resolvedPublicId = String(asset.publicId || asset.storagePath || asset.id).slice(0, 500);
  const payload: Record<string, any> = {
    id: asset.id,
    name: asset.name.slice(0, 250),
    category: asset.category,
    downloadUrl: asset.downloadUrl,
    ...(asset.cloudinaryUrl ? { cloudinaryUrl: asset.cloudinaryUrl } : {}),
    publicId: resolvedPublicId,
    cloudinaryResourceType: asset.cloudinaryResourceType || 'image',
    ...(typeof asset.directPdfDelivery === 'boolean'
      ? { directPdfDelivery: asset.directPdfDelivery }
      : {}),
    storagePath: resolvedPublicId,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
  if (asset.format) {
    payload.format = asset.format.slice(0, 32);
  }
  if (asset.linkedEntityType) {
    payload.linkedEntityType = asset.linkedEntityType.slice(0, 60);
  }
  if (asset.linkedEntityId) {
    payload.linkedEntityId = asset.linkedEntityId.slice(0, 120);
  }
  if (asset.uploadedBy) {
    payload.uploadedBy = asset.uploadedBy.slice(0, 200);
  }
  return payload;
}

async function saveMediaAssetToBackend(asset: MediaAsset): Promise<MediaAsset> {
  const res = await fetch('/api/admin/media', {
    method: 'POST',
    headers: getBackendAuthHeaders(true),
    credentials: 'include',
    body: JSON.stringify(asset),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed saving media metadata.' }));
    throw new Error(err.error || 'Failed saving media metadata.');
  }

  const data = await res.json();
  return data.asset || asset;
}

async function deleteMediaAssetFromBackend(assetId: string, cloudDestroyed = false): Promise<void> {
  const qs = cloudDestroyed ? '?cloudDestroyed=true' : '';
  const res = await fetch(`/api/admin/media/${encodeURIComponent(assetId)}${qs}`, {
    method: 'DELETE',
    headers: getBackendAuthHeaders(false),
    credentials: 'include',
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({ error: 'Failed deleting media record.' }));
    throw new Error(err.error || 'Failed deleting media record.');
  }
}

async function destroyCloudinaryOnBackend(
  publicId: string,
  resourceType?: 'image' | 'raw' | 'video'
): Promise<void> {
  const res = await fetch('/api/admin/cloudinary/destroy', {
    method: 'POST',
    headers: getBackendAuthHeaders(true),
    credentials: 'include',
    body: JSON.stringify({
      publicId,
      ...(resourceType ? { resourceType } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed deleting asset from Cloudinary.' }));
    throw new Error(err.error || 'Failed deleting asset from Cloudinary.');
  }
}

interface SignedCloudinaryParams {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  accessMode?: string;
  overwrite: string;
  invalidate: string;
  uploadUrl: string;
}

interface CloudinaryUploadResponse {
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'raw' | 'video';
  version?: string | number;
  format: string;
  bytes: number;
}

interface VerifiedPdfDeliveryResult {
  verified: boolean;
  resourceType: 'image' | 'raw' | 'video';
  bytes?: number;
  cloudinaryUrl: string;
  publicViewUrl: string;
  publicDownloadUrl: string;
  directPdfDelivery: boolean;
  directHttpStatus?: number;
  directError?: string | null;
}

async function verifyCloudinaryPdfUpload(params: {
  publicId: string;
  resourceType: 'image' | 'raw' | 'video';
  version?: string | number;
  secureUrl: string;
  fileName: string;
}): Promise<VerifiedPdfDeliveryResult> {
  const res = await fetch('/api/admin/cloudinary/verify-pdf', {
    method: 'POST',
    headers: getBackendAuthHeaders(true),
    credentials: 'include',
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.verified) {
    const baseErr =
      data?.error ||
      `PDF delivery verification failed (HTTP ${data?.directHttpStatus || res.status || 401}).`;
    throw new Error(
      `${baseErr} Verify Cloudinary Security settings ("Allow delivery of PDF and ZIP files") and try again.`
    );
  }

  setCachedDirectPdfAllowed(Boolean(data.directPdfDelivery));

  return {
    verified: true,
    resourceType:
      data.resourceType === 'raw' || data.resourceType === 'video'
        ? data.resourceType
        : params.resourceType,
    bytes: typeof data.bytes === 'number' ? data.bytes : undefined,
    cloudinaryUrl: String(data.cloudinaryUrl || data.secureUrl || params.secureUrl),
    publicViewUrl: String(data.publicViewUrl || data.secureUrl || params.secureUrl),
    publicDownloadUrl: String(data.publicDownloadUrl || data.secureUrl || params.secureUrl),
    directPdfDelivery: Boolean(data.directPdfDelivery),
    directHttpStatus: typeof data.directHttpStatus === 'number' ? data.directHttpStatus : undefined,
    directError: typeof data.directError === 'string' ? data.directError : null,
  };
}

/**
 * Requests a short-lived cryptographic signature from the backend and uploads the file
 * directly to Cloudinary via XMLHttpRequest with real byte-level progress tracking.
 */
async function uploadFileViaSignedCloudinaryXhr(params: {
  file: File;
  mimeType: string;
  category: MediaCategory;
  acceptKind: MediaAcceptKind;
  replacePublicId?: string;
  onProgress?: (info: UploadProgressInfo) => void;
  onTaskCreated?: (cancelFn: () => void) => void;
}): Promise<CloudinaryUploadResponse> {
  const { file, mimeType, category, acceptKind, replacePublicId, onProgress, onTaskCreated } = params;

  // 1. Obtain server-signed upload parameters
  const signRes = await fetch('/api/admin/cloudinary/sign', {
    method: 'POST',
    headers: getBackendAuthHeaders(true),
    credentials: 'include',
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
      category,
      acceptKind,
      ...(replacePublicId ? { replacePublicId } : {}),
    }),
  });

  const signData = await signRes.json().catch(() => ({}));
  if (!signRes.ok) {
    if (signRes.status === 401) {
      throw new Error('Admin authentication required. Please sign in to the Admin Panel first.');
    }
    throw new Error(
      signData?.error ||
        'Cloudinary upload authorization failed. Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Secrets.'
    );
  }

  const signed = signData as SignedCloudinaryParams;
  if (!signed.uploadUrl || !signed.signature || !signed.apiKey || !signed.publicId) {
    throw new Error('Invalid upload signature payload received from server.');
  }

  // 2. Build exact FormData matching the parameters signed by the backend SHA-1 signature
  const formData = new FormData();
  formData.append('file', file);
  formData.append('access_mode', String(signed.accessMode || 'public'));
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', String(signed.timestamp));
  formData.append('signature', signed.signature);
  formData.append('public_id', signed.publicId);
  formData.append('overwrite', String(signed.overwrite || 'true'));
  formData.append('invalidate', String(signed.invalidate || 'true'));

  // 3. Upload directly to Cloudinary over HTTPS with XHR progress reporting
  const cloudinaryPayload = await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let abortedByUser = false;

    onTaskCreated?.(() => {
      abortedByUser = true;
      xhr.abort();
    });

    xhr.open('POST', signed.uploadUrl, true);

    xhr.upload.onprogress = (event) => {
      const total = event.lengthComputable && event.total > 0 ? event.total : file.size || 1;
      const loaded = Math.min(total, event.loaded);
      const progress = Math.min(100, Math.round((loaded / total) * 100));
      onProgress?.({
        progress,
        bytesTransferred: loaded,
        totalBytes: total,
        state: 'running',
      });
    };

    xhr.onload = () => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(xhr.responseText || '{}');
      } catch {
        parsed = {};
      }

      if (xhr.status >= 200 && xhr.status < 300 && (parsed.secure_url || parsed.url)) {
        onProgress?.({
          progress: 100,
          bytesTransferred: file.size,
          totalBytes: file.size,
          state: 'success',
        });
        resolve(parsed);
      } else {
        onProgress?.({
          progress: 0,
          bytesTransferred: 0,
          totalBytes: file.size,
          state: 'error',
        });
        const cloudMsg =
          parsed?.error?.message || `Cloudinary rejected the upload (HTTP ${xhr.status}).`;
        reject(new Error(`Cloudinary upload failed: ${cloudMsg}`));
      }
    };

    xhr.onerror = () => {
      onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        state: 'error',
      });
      reject(
        new Error(
          'Network error while uploading to Cloudinary. Check your internet connection and verify CLOUDINARY_CLOUD_NAME is valid.'
        )
      );
    };

    xhr.onabort = () => {
      onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        state: 'canceled',
      });
      reject(
        new Error(abortedByUser ? 'Upload canceled by user.' : 'Upload aborted unexpectedly.')
      );
    };

    xhr.send(formData);
  });

  const secureUrl = String(cloudinaryPayload.secure_url || cloudinaryPayload.url);
  const publicId = String(cloudinaryPayload.public_id || signed.publicId);
  const resourceType: 'image' | 'raw' | 'video' =
    cloudinaryPayload.resource_type === 'raw' ||
    cloudinaryPayload.resource_type === 'video' ||
    cloudinaryPayload.resource_type === 'image'
      ? cloudinaryPayload.resource_type
      : 'image';
  const format = String(
    cloudinaryPayload.format ||
      (mimeType === 'application/pdf' ? 'pdf' : file.name.split('.').pop() || '')
  )
    .toLowerCase()
    .slice(0, 32);

  return {
    secureUrl,
    publicId,
    resourceType,
    version: cloudinaryPayload.version,
    format,
    bytes: Number(cloudinaryPayload.bytes || file.size),
  };
}

/**
 * Uploads a File (JPG, JPEG, PNG, WEBP, or PDF up to 10 MB) from laptop/phone
 * via server-signed Cloudinary upload, verifies PDF delivery, then saves metadata to backend & Firestore.
 */
export async function uploadMediaFile(options: {
  file: File;
  category: MediaCategory;
  acceptKind?: MediaAcceptKind;
  publishImmediately?: boolean;
  linkedEntityType?: string;
  linkedEntityId?: string;
  onProgress?: (info: UploadProgressInfo) => void;
  onTaskCreated?: (cancelFn: () => void) => void;
}): Promise<MediaAsset> {
  const {
    file,
    category,
    acceptKind = 'both',
    publishImmediately = false,
    linkedEntityType,
    linkedEntityId,
    onProgress,
    onTaskCreated,
  } = options;

  const validation = validateMediaFile(file, acceptKind);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file.');
  }

  const uploaded = await uploadFileViaSignedCloudinaryXhr({
    file,
    mimeType: validation.resolvedMimeType,
    category,
    acceptKind,
    onProgress,
    onTaskCreated,
  });

  // For PDFs, verify actual Cloudinary storage + delivery BEFORE modifying database records
  let verifiedPdf: VerifiedPdfDeliveryResult | null = null;
  if (validation.isPdf) {
    try {
      verifiedPdf = await verifyCloudinaryPdfUpload({
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        version: uploaded.version,
        secureUrl: uploaded.secureUrl,
        fileName: file.name,
      });
    } catch (verifyErr) {
      await destroyCloudinaryOnBackend(uploaded.publicId, uploaded.resourceType).catch(() => {});
      throw verifyErr;
    }
  }

  const initialStatus: 'draft' | 'published' = publishImmediately ? 'published' : 'draft';
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  const id = `media_${timestamp}_${rand}`;
  const nowIso = new Date().toISOString();

  const uploaderIdentity =
    auth.currentUser?.email || sessionStorage.getItem('admin_username') || 'admin';

  const resolvedViewUrl = verifiedPdf ? verifiedPdf.publicViewUrl : uploaded.secureUrl;
  const resolvedDownloadUrl = verifiedPdf ? verifiedPdf.publicDownloadUrl : uploaded.secureUrl;

  const asset: MediaAsset = {
    id,
    name: file.name.slice(0, 250),
    category,
    downloadUrl: resolvedViewUrl,
    cloudinaryUrl: uploaded.secureUrl,
    publicViewUrl: resolvedViewUrl,
    publicDownloadUrl: resolvedDownloadUrl,
    publicId: uploaded.publicId,
    cloudinaryResourceType: verifiedPdf?.resourceType || uploaded.resourceType,
    ...(verifiedPdf ? { directPdfDelivery: verifiedPdf.directPdfDelivery } : {}),
    ...(uploaded.format ? { format: uploaded.format } : {}),
    storagePath: uploaded.publicId,
    mimeType: validation.resolvedMimeType,
    sizeBytes: verifiedPdf?.bytes || uploaded.bytes || file.size,
    status: initialStatus,
    ...(linkedEntityType ? { linkedEntityType } : {}),
    ...(linkedEntityId ? { linkedEntityId } : {}),
    uploadedBy: uploaderIdentity,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Persist to backend database first (always available for authenticated admins)
  const savedAsset = await saveMediaAssetToBackend(asset);

  // Sync to Cloud Firestore when Google Admin Auth is connected
  if (isFirebaseAuthorizedAdmin(auth.currentUser)) {
    try {
      await setDoc(doc(db, 'media_assets', savedAsset.id), buildCleanMediaDoc(savedAsset));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `media_assets/${savedAsset.id}`);
    }
  }

  return {
    ...savedAsset,
    cloudinaryUrl: savedAsset.cloudinaryUrl || uploaded.secureUrl,
    publicViewUrl: resolvedViewUrl,
    publicDownloadUrl: resolvedDownloadUrl,
    ...(verifiedPdf ? { directPdfDelivery: verifiedPdf.directPdfDelivery } : {}),
  };
}

/**
 * Replaces an existing MediaAsset's file in Cloudinary, verifies PDF delivery when applicable,
 * and updates both backend store and Firestore metadata safely without broken references.
 */
export async function replaceMediaFile(
  existingAsset: MediaAsset,
  newFile: File,
  options?: {
    acceptKind?: MediaAcceptKind;
    onProgress?: (info: UploadProgressInfo) => void;
    onTaskCreated?: (cancelFn: () => void) => void;
  }
): Promise<MediaAsset> {
  const acceptKind = options?.acceptKind || 'both';
  const validation = validateMediaFile(newFile, acceptKind);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid replacement file.');
  }

  const prevPublicId = existingAsset.publicId || existingAsset.storagePath;

  const uploaded = await uploadFileViaSignedCloudinaryXhr({
    file: newFile,
    mimeType: validation.resolvedMimeType,
    category: existingAsset.category,
    acceptKind,
    replacePublicId: prevPublicId,
    onProgress: options?.onProgress,
    onTaskCreated: options?.onTaskCreated,
  });

  // Verify PDF delivery before touching backend/Firestore records
  let verifiedPdf: VerifiedPdfDeliveryResult | null = null;
  if (validation.isPdf) {
    verifiedPdf = await verifyCloudinaryPdfUpload({
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      version: uploaded.version,
      secureUrl: uploaded.secureUrl,
      fileName: newFile.name,
    });
  }

  // If Cloudinary assigned a different publicId or resourceType (e.g., PNG replaced by PDF), clean up old asset
  if (
    prevPublicId &&
    (uploaded.publicId !== prevPublicId ||
      (existingAsset.cloudinaryResourceType &&
        uploaded.resourceType !== existingAsset.cloudinaryResourceType))
  ) {
    await destroyCloudinaryOnBackend(prevPublicId, existingAsset.cloudinaryResourceType).catch(
      () => {}
    );
  }

  const uploaderIdentity =
    auth.currentUser?.email ||
    sessionStorage.getItem('admin_username') ||
    existingAsset.uploadedBy ||
    'admin';

  const resolvedViewUrl = verifiedPdf ? verifiedPdf.publicViewUrl : uploaded.secureUrl;
  const resolvedDownloadUrl = verifiedPdf ? verifiedPdf.publicDownloadUrl : uploaded.secureUrl;

  const updatedAsset: MediaAsset = {
    ...existingAsset,
    name: newFile.name.slice(0, 250),
    downloadUrl: resolvedViewUrl,
    cloudinaryUrl: uploaded.secureUrl,
    publicViewUrl: resolvedViewUrl,
    publicDownloadUrl: resolvedDownloadUrl,
    publicId: uploaded.publicId,
    cloudinaryResourceType: verifiedPdf?.resourceType || uploaded.resourceType,
    ...(verifiedPdf
      ? { directPdfDelivery: verifiedPdf.directPdfDelivery }
      : { directPdfDelivery: undefined }),
    ...(uploaded.format ? { format: uploaded.format } : {}),
    storagePath: uploaded.publicId,
    mimeType: validation.resolvedMimeType,
    sizeBytes: verifiedPdf?.bytes || uploaded.bytes || newFile.size,
    uploadedBy: uploaderIdentity,
    updatedAt: new Date().toISOString(),
  };

  const savedAsset = await saveMediaAssetToBackend(updatedAsset);

  if (isFirebaseAuthorizedAdmin(auth.currentUser)) {
    try {
      await setDoc(doc(db, 'media_assets', savedAsset.id), buildCleanMediaDoc(savedAsset));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `media_assets/${savedAsset.id}`);
    }
  }

  return {
    ...savedAsset,
    cloudinaryUrl: savedAsset.cloudinaryUrl || uploaded.secureUrl,
    publicViewUrl: resolvedViewUrl,
    publicDownloadUrl: resolvedDownloadUrl,
    ...(verifiedPdf ? { directPdfDelivery: verifiedPdf.directPdfDelivery } : {}),
  };
}

/**
 * Deletes a MediaAsset from Cloudinary (via server-signed destroy) and removes metadata from backend & Firestore.
 */
export async function deleteMediaAsset(asset: MediaAsset): Promise<void> {
  const targetPublicId = asset.publicId || asset.storagePath;
  const shouldDestroyCloud = Boolean(
    targetPublicId &&
      (isCloudinaryUrl(asset.downloadUrl) ||
        isCloudinaryPdfBridgeUrl(asset.downloadUrl) ||
        isCloudinaryUrl(asset.cloudinaryUrl))
  );

  if (shouldDestroyCloud && targetPublicId) {
    await destroyCloudinaryOnBackend(targetPublicId, asset.cloudinaryResourceType);
  }

  await deleteMediaAssetFromBackend(asset.id, shouldDestroyCloud);

  if (isFirebaseAuthorizedAdmin(auth.currentUser)) {
    try {
      await deleteDoc(doc(db, 'media_assets', asset.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `media_assets/${asset.id}`);
    }
  }
}

/**
 * Deletes a Cloudinary asset by publicId (and cleans up any linked media_assets metadata),
 * used when removing/replacing an uploaded file directly inside Profile, Resume, Project, or Certificate editors.
 */
export async function deleteCloudinaryFileByPublicId(
  publicId?: string,
  resourceType?: 'image' | 'raw' | 'video'
): Promise<void> {
  if (!publicId) return;

  await destroyCloudinaryOnBackend(publicId, resourceType);

  if (isFirebaseAuthorizedAdmin(auth.currentUser)) {
    try {
      const snapByPub = await getDocs(
        query(collection(db, 'media_assets'), where('publicId', '==', publicId))
      );
      for (const d of snapByPub.docs) {
        await deleteDoc(doc(db, 'media_assets', d.id));
      }
      const snapByLegacy = await getDocs(
        query(collection(db, 'media_assets'), where('storagePath', '==', publicId))
      );
      for (const d of snapByLegacy.docs) {
        await deleteDoc(doc(db, 'media_assets', d.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `media_assets`);
    }
  }
}

/**
 * Updates publish visibility ('draft' | 'published') on backend store and Firestore.
 */
export async function updateMediaAssetStatus(
  asset: MediaAsset,
  nextStatus: 'draft' | 'published'
): Promise<MediaAsset> {
  const res = await fetch(`/api/admin/media/${encodeURIComponent(asset.id)}`, {
    method: 'PATCH',
    headers: getBackendAuthHeaders(true),
    credentials: 'include',
    body: JSON.stringify({ status: nextStatus }),
  });

  let updated: MediaAsset;
  if (res.ok) {
    const data = await res.json();
    updated = data.asset || {
      ...asset,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
  } else {
    updated = {
      ...asset,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
  }

  if (isFirebaseAuthorizedAdmin(auth.currentUser)) {
    try {
      await setDoc(doc(db, 'media_assets', updated.id), buildCleanMediaDoc(updated));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `media_assets/${updated.id}`);
    }
  }

  return updated;
}

/**
 * Lists MediaAssets from Firestore and backend metadata store, merging by newest timestamp.
 */
export async function listMediaAssets(includeDrafts = false): Promise<MediaAsset[]> {
  const byId = new Map<string, MediaAsset>();

  const normalizeItem = (raw: any, fallbackId?: string): MediaAsset | null => {
    if (!raw || !raw.downloadUrl) return null;
    const id = String(raw.id || fallbackId || '');
    if (!id) return null;
    const publicId = String(raw.publicId || raw.storagePath || id);
    return {
      ...raw,
      id,
      publicId,
      storagePath: publicId,
    } as MediaAsset;
  };

  // 1. Fetch Firestore
  try {
    const canReadDrafts = includeDrafts && isFirebaseAuthorizedAdmin(auth.currentUser);
    const q = canReadDrafts
      ? collection(db, 'media_assets')
      : query(collection(db, 'media_assets'), where('status', '==', 'published'));

    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const normalized = normalizeItem(docSnap.data(), docSnap.id);
      if (normalized) {
        byId.set(normalized.id, normalized);
      }
    });
  } catch (err) {
    if (includeDrafts && isFirebaseAuthorizedAdmin(auth.currentUser)) {
      handleFirestoreError(err, OperationType.LIST, 'media_assets');
    }
    console.warn('[MediaStorage] Firestore list fallback to backend:', err);
  }

  // 2. Fetch Express backend metadata store and merge newer versions
  try {
    const endpoint = includeDrafts ? '/api/admin/media' : '/api/public/media';
    const res = await fetch(endpoint, {
      headers: includeDrafts ? getBackendAuthHeaders(false) : {},
      credentials: 'include',
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        const apiIds = new Set<string>();
        for (const rawItem of list) {
          const item = normalizeItem(rawItem);
          if (!item) continue;
          if (!includeDrafts && item.status !== 'published') continue;
          apiIds.add(item.id);
          const existing = byId.get(item.id);
          const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
          const existingTime = existing
            ? new Date(existing.updatedAt || existing.createdAt || 0).getTime()
            : -1;
          if (!existing || itemTime >= existingTime) {
            byId.set(item.id, item);
          }
        }
        // When backend API succeeded and user isn't signed into Google Auth, prune items removed on backend
        if (!isFirebaseAuthorizedAdmin(auth.currentUser) && apiIds.size >= 0) {
          for (const id of Array.from(byId.keys())) {
            if (!apiIds.has(id)) {
              byId.delete(id);
            }
          }
        }
      }
    }
  } catch {
    // Ignore backend fallback failure
  }

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
  );
}

/**
 * Ensures any uploaded MediaAsset matching a publicId is marked 'published'
 * when attached to a published portfolio item.
 */
export async function publishMediaAssetByPublicId(publicId?: string): Promise<void> {
  if (!publicId) return;
  try {
    const all = await listMediaAssets(true);
    const matches = all.filter(
      (m) => m.publicId === publicId || m.storagePath === publicId
    );
    for (const asset of matches) {
      if (asset.status !== 'published') {
        await updateMediaAssetStatus(asset, 'published');
      }
    }
  } catch (err) {
    console.warn('[MediaStorage] Failed to publish linked media asset:', err);
  }
}
