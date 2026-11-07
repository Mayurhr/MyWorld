export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  iconLink?: string;
  size?: string;
  modifiedTime?: string;
}

export interface DriveSearchResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

/**
 * Searches and lists files from the authenticated user's Google Drive.
 * Uses Drive API v3 files.list endpoint with the user's access token.
 */
export async function searchDriveFiles(
  accessToken: string,
  options: {
    query?: string;
    mimeType?: 'image' | 'pdf' | 'all';
    pageToken?: string;
    pageSize?: number;
  } = {}
): Promise<DriveSearchResponse> {
  const { query = '', mimeType = 'all', pageToken = '', pageSize = 24 } = options;

  const queryParts: string[] = ['trashed = false'];

  if (mimeType === 'image') {
    queryParts.push("mimeType contains 'image/'");
  } else if (mimeType === 'pdf') {
    queryParts.push("mimeType = 'application/pdf'");
  } else {
    // Images and PDFs are most relevant for portfolio media
    queryParts.push("(mimeType contains 'image/' or mimeType = 'application/pdf')");
  }

  if (query.trim()) {
    const escapedQuery = query.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escapedQuery}'`);
  }

  const q = queryParts.join(' and ');
  const fields = 'nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, iconLink, size, modifiedTime)';
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', fields);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('orderBy', 'modifiedTime desc');
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Google Drive API Error]', response.status, errorBody);
    throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Helper to fetch a list of drive files matching query and type.
 */
export async function listDriveFiles(
  accessToken: string,
  options: {
    searchQuery?: string;
    mimeType?: string;
    pageSize?: number;
  } = {}
): Promise<DriveFile[]> {
  const mime = options.mimeType?.includes('image')
    ? 'image'
    : options.mimeType?.includes('pdf')
    ? 'pdf'
    : 'all';

  const res = await searchDriveFiles(accessToken, {
    query: options.searchQuery,
    mimeType: mime,
    pageSize: options.pageSize || 30,
  });

  return res.files;
}

/**
 * Converts a Google Drive File ID into an authoritative Drive view URL.
 */
export function formatDriveViewUrl(fileId: string): string {
  if (!fileId) return '';
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Converts a Google Drive File ID into an authoritative Drive thumbnail URL.
 */
export function formatDriveThumbnailUrl(fileId: string, size = 1600): string {
  if (!fileId) return '';
  return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
}
