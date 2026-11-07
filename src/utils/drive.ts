export function getCertificateBadgeLabel(category?: string): string {
  if (!category) return '🌟 Featured';
  const cat = category.toLowerCase();
  if (cat.includes('activity')) return '💼 Activity';
  if (cat.includes('entrepreneurship') || cat.includes('boot camp')) return '💡 Entrepreneurship';
  if (cat.includes('hackathon')) return '🏆 Hackathon';
  if (cat.includes('quiz')) return '🧠 Quiz';
  if (cat.includes('course')) return '🎓 Course';
  if (cat.includes('workshop')) return '📜 Workshop';
  if (cat.includes('cyber')) return '🛡️ Cyber Security';
  if (cat.includes('ai') || cat.includes('generative')) return '🤖 Generative AI';
  return `🌟 ${category}`;
}

export function isCloudinaryUrl(url?: string): boolean {
  if (!url) return false;
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com/');
}

export function isCloudinaryPdfBridgeUrl(url?: string): boolean {
  if (!url) return false;
  return url.includes('/api/public/cloudinary/pdf');
}

export interface PublicCloudinaryStatus {
  configured: boolean;
  directPdfAllowed: boolean | null;
}

let cachedPublicCloudinaryStatus: PublicCloudinaryStatus | null = null;
let inFlightPublicStatusPromise: Promise<PublicCloudinaryStatus> | null = null;

export async function getPublicCloudinaryStatus(
  forceRefresh = false
): Promise<PublicCloudinaryStatus> {
  if (!forceRefresh && cachedPublicCloudinaryStatus) {
    return cachedPublicCloudinaryStatus;
  }
  if (!forceRefresh && inFlightPublicStatusPromise) {
    return inFlightPublicStatusPromise;
  }

  inFlightPublicStatusPromise = fetch('/api/public/cloudinary/status', {
    cache: 'no-store',
  })
    .then(async (res) => {
      if (!res.ok) {
        return { configured: true, directPdfAllowed: false };
      }
      const data = await res.json();
      const normalized: PublicCloudinaryStatus = {
        configured: Boolean(data.configured),
        directPdfAllowed:
          typeof data.directPdfAllowed === 'boolean' ? data.directPdfAllowed : null,
      };
      cachedPublicCloudinaryStatus = normalized;
      return normalized;
    })
    .catch(() => ({ configured: true, directPdfAllowed: false }))
    .finally(() => {
      inFlightPublicStatusPromise = null;
    });

  return inFlightPublicStatusPromise;
}

export function setCachedDirectPdfAllowed(allowed: boolean | null): void {
  cachedPublicCloudinaryStatus = {
    configured: cachedPublicCloudinaryStatus?.configured ?? true,
    directPdfAllowed: allowed,
  };
}

export function extractCloudinaryPublicIdFromUrl(
  url?: string
): { publicId: string; resourceType: 'image' | 'raw' | 'video' } | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (isCloudinaryPdfBridgeUrl(trimmed)) {
    try {
      const u = new URL(trimmed, 'http://localhost');
      const pid = u.searchParams.get('publicId');
      const rt = u.searchParams.get('rt');
      const rType: 'image' | 'raw' | 'video' =
        rt === 'raw' || rt === 'video' ? rt : 'image';
      if (pid && pid.startsWith('portfolio-media/')) {
        return { publicId: pid, resourceType: rType };
      }
      const rawUrlParam = u.searchParams.get('url');
      if (rawUrlParam) {
        return extractCloudinaryPublicIdFromUrl(rawUrlParam);
      }
    } catch {
      // fall through
    }
  }

  const match = trimmed.match(
    /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(portfolio-media\/[a-zA-Z0-9/_-]+?)(?:\.([a-zA-Z0-9]+))?(?:\?.*)?$/i
  );
  if (match) {
    return {
      resourceType: match[1] as 'image' | 'raw' | 'video',
      publicId: match[2],
    };
  }

  return null;
}

export function buildCloudinaryPdfBridgeUrl(params: {
  publicId: string;
  resourceType?: 'image' | 'raw' | 'video';
  fileName?: string;
  download?: boolean;
}): string {
  const qs = new URLSearchParams({
    publicId: params.publicId,
    rt: params.resourceType || 'image',
  });
  if (params.fileName) {
    qs.set('filename', params.fileName);
  }
  if (params.download) {
    qs.set('download', '1');
  }
  return `/api/public/cloudinary/pdf?${qs.toString()}`;
}

export function buildCloudinaryPdfViewerUrl(params: {
  publicId: string;
  resourceType?: 'image' | 'raw' | 'video';
  fileName?: string;
}): string {
  const qs = new URLSearchParams({
    publicId: params.publicId,
    rt: params.resourceType || 'image',
  });
  if (params.fileName) {
    qs.set('filename', params.fileName);
  }
  return `/api/public/cloudinary/pdf/view?${qs.toString()}`;
}

/**
 * Builds a reliable browser download URL for Cloudinary PDFs/images without touching
 * Cloudinary /raw/upload/ assets or Google Drive URLs.
 */
export function getCloudinaryDownloadUrl(url?: string): string {
  if (!url) return '';
  if (isCloudinaryPdfBridgeUrl(url)) {
    try {
      const u = new URL(url, 'http://localhost');
      u.searchParams.set('download', '1');
      return `${u.pathname}${u.search}`;
    } catch {
      return url.includes('download=') ? url : `${url}&download=1`;
    }
  }
  if (
    isCloudinaryUrl(url) &&
    url.includes('/upload/') &&
    !url.includes('/raw/upload/') &&
    !url.includes('/fl_attachment')
  ) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
}

export function getGoogleDriveFileId(url?: string): string {
  if (!url) return '';
  if (isCloudinaryUrl(url) || isCloudinaryPdfBridgeUrl(url)) return '';

  // Pattern: /file/d/FILE_ID or /d/FILE_ID
  const matchD = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (matchD) return matchD[1];

  // Pattern: ?id=FILE_ID or &id=FILE_ID
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (matchId) return matchId[1];

  // Pattern: thumbnail?id=...
  const matchThumb = url.match(/thumbnail\?id=([a-zA-Z0-9_-]{10,})/);
  if (matchThumb) return matchThumb[1];

  return '';
}

// Genuine PDF detection based on file extension and format (works for Drive, Cloudinary & external URLs)
export const PDF_FILE_IDS = new Set<string>();

export function isPdfCertificate(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    /\.pdf($|[?#&])/.test(lower) ||
    lower.includes('/api/public/cloudinary/pdf') ||
    lower.includes('format=pdf') ||
    lower.includes('application/pdf') ||
    lower.includes('application%2fpdf') ||
    (isCloudinaryUrl(lower) && lower.includes('/raw/upload/'))
  );
}

export function getAchievementSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Generates the authoritative Google Drive thumbnail preview URL.
 * Returns direct URL unchanged for Cloudinary or external image URLs.
 */
export function getGoogleDriveThumbnailUrl(driveUrl?: string, size: number = 2000): string {
  if (!driveUrl) return '';

  const fileId = getGoogleDriveFileId(driveUrl);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
  }

  return driveUrl;
}

export function getGoogleDriveImageUrl(driveUrl?: string, size: number = 2000): string {
  return getGoogleDriveThumbnailUrl(driveUrl, size);
}

/**
 * Returns prioritized fallback endpoints for Google Drive images,
 * or `[driveUrl]` directly for Cloudinary / local / standard URLs.
 */
export function getGoogleDriveImageFallbacks(driveUrl?: string, size: number = 2000): string[] {
  if (!driveUrl) return [];

  const fileId = getGoogleDriveFileId(driveUrl);
  if (!fileId) return [driveUrl];

  return [
    `https://lh3.googleusercontent.com/d/${fileId}=w${size}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
    `https://drive.google.com/uc?export=view&id=${fileId}`,
  ];
}

/**
 * Generates preview URL for embedding PDF documents in an iframe.
 */
export function getGoogleDrivePdfPreviewUrl(url?: string): string {
  if (!url) return '';
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Generates direct view URL for opening full document in new tab.
 */
export function getGoogleDriveDirectViewUrl(url?: string): string {
  if (!url) return '';
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Generates direct download URL for Google Drive or Cloudinary documents.
 */
export function getDocumentDownloadUrl(url?: string): string {
  if (!url) return '';
  if (isCloudinaryPdfBridgeUrl(url)) {
    return getCloudinaryDownloadUrl(url);
  }
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return getCloudinaryDownloadUrl(url);
}

/**
 * Resolves a playable/downloadable URL for PDFs across Google Drive, direct Cloudinary CDN,
 * and the server-signed Cloudinary PDF bridge when Cloudinary's CDN PDF restriction returns 401.
 * Leaves Google Drive URLs 100% untouched.
 */
export function resolvePlayablePdfUrl(
  url?: string,
  options?: {
    directPdfAllowed?: boolean | null;
    cloudinaryUrl?: string;
    fileName?: string;
    download?: boolean;
    forIframeEmbed?: boolean;
  }
): string {
  if (!url) return '';
  const directAllowed = options?.directPdfAllowed === true;

  // 1. Preserve Google Drive URLs completely untouched
  if (!isCloudinaryUrl(url) && !isCloudinaryPdfBridgeUrl(url)) {
    return options?.download ? getDocumentDownloadUrl(url) : getGoogleDrivePdfPreviewUrl(url);
  }

  // 2. Direct Cloudinary CDN delivery (only if verified allowed, and not embedding in an iframe where nested sandbox blocks plugins)
  const directSource =
    options?.cloudinaryUrl && isCloudinaryUrl(options.cloudinaryUrl)
      ? options.cloudinaryUrl
      : isCloudinaryUrl(url)
      ? url
      : '';

  if (directAllowed && directSource && !options?.forIframeEmbed) {
    return options?.download ? getCloudinaryDownloadUrl(directSource) : directSource;
  }

  // 3. Extract public ID
  const extracted =
    extractCloudinaryPublicIdFromUrl(url) ||
    (directSource ? extractCloudinaryPublicIdFromUrl(directSource) : null);

  // If embedding in an iframe, use dedicated HTML PDF viewer to eliminate Chromium subframe PDF plugin blocking
  if (options?.forIframeEmbed) {
    if (extracted) {
      return buildCloudinaryPdfViewerUrl({
        publicId: extracted.publicId,
        resourceType: extracted.resourceType,
        fileName: options?.fileName,
      });
    }
    if (isCloudinaryUrl(url)) {
      const qs = new URLSearchParams({ url });
      if (options?.fileName) qs.set('filename', options.fileName);
      return `/api/public/cloudinary/pdf/view?${qs.toString()}`;
    }
  }

  // For download or direct tab viewing
  if (extracted) {
    return buildCloudinaryPdfBridgeUrl({
      publicId: extracted.publicId,
      resourceType: extracted.resourceType,
      fileName: options?.fileName,
      download: options?.download,
    });
  }

  if (isCloudinaryUrl(url) && !isCloudinaryPdfBridgeUrl(url)) {
    const qs = new URLSearchParams({ url });
    if (options?.fileName) qs.set('filename', options.fileName);
    if (options?.download) qs.set('download', '1');
    return `/api/public/cloudinary/pdf?${qs.toString()}`;
  }

  return options?.download ? getDocumentDownloadUrl(url) : url;
}

export function getEmbedInfo(url?: string): { type: 'iframe' | 'video'; src: string } | null {
  if (!url) return null;

  // Local mp4 video asset
  if (url.includes('assest/videos/') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg')) {
    const cleanUrl = url.startsWith('/') || url.startsWith('http') ? url : `/${url}`;
    return { type: 'video', src: cleanUrl };
  }

  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0` };

  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };

  const driveMatch = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && url.includes('drive.google.com')) {
    return { type: 'iframe', src: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  }

  return { type: 'iframe', src: url };
}
