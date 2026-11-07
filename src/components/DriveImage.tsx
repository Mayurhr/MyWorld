import React, { useState, useEffect, useRef } from 'react';
import {
  getGoogleDriveImageFallbacks,
  isPdfCertificate,
  getGoogleDriveFileId,
} from '../utils/drive';

interface DriveImageProps {
  driveUrl: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  size?: number;
  onClick?: () => void;
}

export const DriveImage: React.FC<DriveImageProps> = ({
  driveUrl,
  alt,
  className = '',
  wrapperClassName = '',
  size = 2000,
  onClick,
}) => {
  const [sources, setSources] = useState<string[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const isPdf = isPdfCertificate(driveUrl);
  const fileId = getGoogleDriveFileId(driveUrl);
  // Direct PDF files (such as Cloudinary PDFs) cannot be rendered inside <img>; render a dedicated PDF card preview
  const isDirectPdfWithoutThumbnail = isPdf && !fileId;

  useEffect(() => {
    if (isDirectPdfWithoutThumbnail) {
      setSources([]);
      setSourceIndex(0);
      setLoaded(true);
      setError(false);
      return;
    }

    const fallbacks = getGoogleDriveImageFallbacks(driveUrl, size);
    setSources(fallbacks);
    setSourceIndex(0);
    setLoaded(false);
    setError(false);
  }, [driveUrl, size, isDirectPdfWithoutThumbnail]);

  const currentSrc = sources[sourceIndex] || driveUrl;

  // Check if image already loaded (e.g. from browser cache)
  useEffect(() => {
    if (isDirectPdfWithoutThumbnail) return;
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setLoaded(true);
        setError(false);
      } else if (imgRef.current.src && sourceIndex < sources.length - 1) {
        setSourceIndex((prev) => prev + 1);
      } else if (imgRef.current.src) {
        setError(true);
        setLoaded(false);
      }
    }
  }, [currentSrc, sources.length, sourceIndex, isDirectPdfWithoutThumbnail]);

  const handleLoad = () => {
    setLoaded(true);
    setError(false);
  };

  const handleError = () => {
    if (sourceIndex < sources.length - 1) {
      // Try next fallback endpoint
      setSourceIndex((prev) => prev + 1);
    } else {
      setLoaded(false);
      setError(true);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setLoaded(false);
    setSourceIndex(0);
  };

  if (isDirectPdfWithoutThumbnail) {
    return (
      <div
        className={`drive-img-wrapper loaded ${wrapperClassName}`}
        onClick={onClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #18181b 0%, #111827 100%)',
          border: '1px solid rgba(239, 68, 68, 0.28)',
          gap: '8px',
          padding: '12px',
          textAlign: 'center',
        }}
      >
        <span className="pdf-corner-badge" title="PDF Document">
          <i className="fas fa-file-pdf"></i> PDF
        </span>
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171',
            fontSize: '22px',
          }}
        >
          <i className="fas fa-file-pdf"></i>
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e4e4e7' }}>
          PDF Certificate Document
        </span>
        <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
          Click to View PDF
        </span>
      </div>
    );
  }

  return (
    <div
      className={`drive-img-wrapper ${!loaded && !error ? 'skeleton' : 'loaded'} ${error ? 'error-state' : ''} ${wrapperClassName}`}
      onClick={onClick}
    >
      {isPdf && !error && (
        <span className="pdf-corner-badge" title="PDF Document">
          <i className="fas fa-file-pdf"></i> PDF
        </span>
      )}

      {error ? (
        <div className="img-error-placeholder">
          <i className={isPdf ? 'fas fa-file-pdf' : 'fas fa-image'}></i>
          <span className="img-error-msg">{isPdf ? 'PDF Document' : 'Image Inaccessible'}</span>
          {fileId && (
            <span className="img-error-sub" style={{ fontSize: '0.72rem', opacity: 0.75 }}>
              ID: {fileId}
            </span>
          )}
          <div className="img-error-actions">
            <button type="button" className="img-retry-btn" onClick={handleRetry}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <img
          ref={imgRef}
          key={currentSrc}
          src={currentSrc}
          alt={alt}
          className={`${className} ${loaded ? 'img-visible' : 'img-hidden'}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
};
