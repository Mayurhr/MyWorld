/**
 * Google Picker API integration service for Google Drive.
 * Conforms to Google's Recommended Scope: https://www.googleapis.com/auth/drive.file
 *
 * Allows administrators to securely select images and PDFs directly from Google Drive
 * without requesting the restricted drive.readonly scope.
 */

import firebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

export interface GooglePickerFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes?: number;
  thumbnailLink?: string;
}

export interface GooglePickerOptions {
  oauthToken: string;
  apiKey?: string;
  appId?: string;
  filterMime?: 'image' | 'pdf' | 'all';
  title?: string;
  onSelect: (file: GooglePickerFile) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

let pickerLoadingPromise: Promise<void> | null = null;

/**
 * Dynamically loads Google APIs client (gapi) and initializes the Google Picker module.
 */
export function loadGooglePickerApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.google?.picker) {
    return Promise.resolve();
  }

  if (pickerLoadingPromise) {
    return pickerLoadingPromise;
  }

  pickerLoadingPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById('google-apis-script');

    const initializePicker = () => {
      if (window.google?.picker) {
        resolve();
        return;
      }
      if (!window.gapi) {
        pickerLoadingPromise = null;
        reject(new Error('Google API client (gapi) is not available.'));
        return;
      }
      window.gapi.load('picker', {
        callback: () => {
          if (window.google?.picker) {
            resolve();
          } else {
            pickerLoadingPromise = null;
            reject(new Error('Google Picker library did not mount on window.google.'));
          }
        },
        onerror: (err: any) => {
          pickerLoadingPromise = null;
          reject(new Error(err?.message || 'Failed loading Google Picker API via gapi.load.'));
        },
      });
    };

    if (existingScript && window.gapi) {
      initializePicker();
      return;
    }

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-apis-script';
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => initializePicker();
      script.onerror = () => {
        pickerLoadingPromise = null;
        reject(
          new Error(
            'Failed to load Google APIs script (https://apis.google.com/js/api.js). Please check network or ad-blocker settings.'
          )
        );
      };
      document.body.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => initializePicker());
    }
  });

  return pickerLoadingPromise;
}

let cachedRuntimeApiKey: string | null = null;

/**
 * Asynchronously loads and resolves the Google Picker developer API key from runtime configuration
 * (/api/config/picker) or environment injections.
 */
export async function resolveGooglePickerApiKey(): Promise<string> {
  const directKey = getGoogleApiKey();
  if (directKey) return directKey;

  try {
    const res = await fetch('/api/config/picker');
    if (res.ok) {
      const data = await res.json();
      if (data?.apiKey && typeof data.apiKey === 'string' && data.apiKey.trim()) {
        cachedRuntimeApiKey = data.apiKey.trim();
        return cachedRuntimeApiKey;
      }
    }
  } catch (err) {
    console.warn('[GooglePickerService] Could not fetch runtime picker config:', err);
  }

  return (firebaseConfig as any).apiKey || '';
}

/**
 * Returns the configured Google Picker API key.
 * Prioritizes the dedicated AI Studio secret (via window.__APP_ENV__ or import.meta.env),
 * cached runtime config, and falls back to the project's Google Cloud API key from firebase-applet-config.json.
 */
export function getGoogleApiKey(): string {
  // 1. Runtime injection via window.__APP_ENV__ (from Cloud Run / Express server)
  const windowEnvKey = (typeof window !== 'undefined' && (window as any).__APP_ENV__?.VITE_GOOGLE_API_KEY);
  if (windowEnvKey && typeof windowEnvKey === 'string' && windowEnvKey.trim()) {
    return windowEnvKey.trim();
  }

  // 2. Vite client-side build injection
  const viteEnvKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY;
  if (viteEnvKey && typeof viteEnvKey === 'string' && viteEnvKey.trim()) {
    return viteEnvKey.trim();
  }

  // 3. Cached runtime API key fetched from /api/config/picker
  if (cachedRuntimeApiKey && cachedRuntimeApiKey.trim()) {
    return cachedRuntimeApiKey.trim();
  }

  // 4. Reliable fallback to the Google Cloud Project 83483776639 API key
  const fbKey = (firebaseConfig as any).apiKey;
  if (fbKey && typeof fbKey === 'string' && fbKey.trim()) {
    return fbKey.trim();
  }

  return '';
}

/**
 * Constructs and opens the Google Picker dialog configured with the user's OAuth token.
 */
export function openGoogleDrivePicker(options: GooglePickerOptions): void {
  const {
    oauthToken,
    apiKey = getGoogleApiKey(),
    appId,
    filterMime = 'all',
    title,
    onSelect,
    onCancel,
    onError,
  } = options;

  if (!window.google?.picker) {
    const error = new Error('Google Picker is not initialized. Call loadGooglePickerApi() first.');
    onError?.(error);
    return;
  }

  if (!oauthToken) {
    const error = new Error('No active OAuth token available for Google Drive. Please connect Google Drive first.');
    onError?.(error);
    return;
  }

  const effectiveApiKey = apiKey || getGoogleApiKey();
  if (!effectiveApiKey) {
    const error = new Error(
      'Google Picker API key is not configured. Please ensure VITE_GOOGLE_API_KEY is defined in AI Studio Secrets or Google Cloud Console.'
    );
    onError?.(error);
    return;
  }

  try {
    const viewGroup: any[] = [];

    if (filterMime === 'image') {
      const imgView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES);
      imgView.setIncludeFolders(true);
      imgView.setSelectFolderEnabled(false);
      imgView.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif');
      imgView.setMode(window.google.picker.DocsViewMode.GRID);
      viewGroup.push(imgView);
    } else if (filterMime === 'pdf') {
      const pdfView = new window.google.picker.DocsView(window.google.picker.ViewId.PDFS);
      pdfView.setIncludeFolders(true);
      pdfView.setSelectFolderEnabled(false);
      pdfView.setMimeTypes('application/pdf');
      viewGroup.push(pdfView);
    } else {
      // Default: Images & PDFs combined view with folder browsing
      const allMediaView = new window.google.picker.DocsView();
      allMediaView.setIncludeFolders(true);
      allMediaView.setSelectFolderEnabled(false);
      allMediaView.setMimeTypes(
        'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,application/pdf'
      );
      allMediaView.setMode(window.google.picker.DocsViewMode.GRID);
      viewGroup.push(allMediaView);

      // Images tab
      const imgTab = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES);
      imgTab.setIncludeFolders(true);
      imgTab.setSelectFolderEnabled(false);
      imgTab.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif');
      viewGroup.push(imgTab);

      // PDFs tab
      const pdfTab = new window.google.picker.DocsView(window.google.picker.ViewId.PDFS);
      pdfTab.setIncludeFolders(true);
      pdfTab.setSelectFolderEnabled(false);
      pdfTab.setMimeTypes('application/pdf');
      viewGroup.push(pdfTab);
    }

    // Google Cloud numeric project number (83483776639)
    const numericProjectNumber =
      appId ||
      (firebaseConfig as any).messagingSenderId ||
      '83483776639';

    const pickerBuilder = new window.google.picker.PickerBuilder()
      .setOAuthToken(oauthToken)
      .setDeveloperKey(effectiveApiKey)
      .setAppId(numericProjectNumber)
      .setCallback((data: any) => {
        const action = data[window.google.picker.Response.ACTION];
        if (action === window.google.picker.Action.PICKED) {
          const doc = data[window.google.picker.Response.DOCUMENTS]?.[0];
          if (doc) {
            const fileId = doc[window.google.picker.Document.ID];
            const name = doc[window.google.picker.Document.NAME] || 'Google Drive File';
            const mimeType =
              doc[window.google.picker.Document.MIME_TYPE] ||
              (filterMime === 'pdf' ? 'application/pdf' : 'image/jpeg');
            const url =
              doc[window.google.picker.Document.URL] ||
              `https://drive.google.com/file/d/${fileId}/view`;
            const sizeBytes = doc[window.google.picker.Document.SIZE_BYTES];
            const thumbnailLink =
              doc[window.google.picker.Document.THUMBNAIL_URL] ||
              `https://lh3.googleusercontent.com/d/${fileId}=w400`;

            onSelect({
              id: fileId,
              name,
              url,
              mimeType,
              sizeBytes,
              thumbnailLink,
            });
          }
        } else if (action === window.google.picker.Action.CANCEL) {
          onCancel?.();
        } else if (action === 'error' || data.error) {
          const detail = data.error?.message || data.error || 'Google Picker reported an authorization error.';
          console.error('[Google Picker Error Callback]', detail);
          onError?.(new Error(String(detail)));
        }
      });

    // Set origin to prevent cross-domain postMessage framing failure
    if (typeof window !== 'undefined' && window.location?.origin) {
      pickerBuilder.setOrigin(window.location.origin);
    }

    // Adaptive sizing for mobile vs desktop displays
    if (typeof window !== 'undefined') {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      if (screenW < 768) {
        const modalW = Math.min(screenW - 16, 560);
        const modalH = Math.min(screenH - 32, 580);
        pickerBuilder.setSize(modalW, modalH);
      }
    }

    const customTitle =
      title ||
      (filterMime === 'pdf'
        ? 'Select Certificate or Resume PDF from Google Drive'
        : filterMime === 'image'
        ? 'Select Certificate or Project Image from Google Drive'
        : 'Select Media File from Google Drive');

    pickerBuilder.setTitle(customTitle);

    viewGroup.forEach((view) => pickerBuilder.addView(view));

    // Enable shared drives support
    pickerBuilder.enableFeature(window.google.picker.Feature.SUPPORT_DRIVES);

    const picker = pickerBuilder.build();
    picker.setVisible(true);
  } catch (err: any) {
    console.error('[Google Picker Build Error]', err?.message || err);
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}
