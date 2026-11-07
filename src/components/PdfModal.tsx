import React, { useEffect, useState } from 'react';
import { Certificate } from '../types';
import { CertificateItem } from '../services/portfolioService';
import {
  getGoogleDriveDirectViewUrl,
  getPublicCloudinaryStatus,
  resolvePlayablePdfUrl,
} from '../utils/drive';

interface PdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate | null;
}

export const PdfModal: React.FC<PdfModalProps> = ({ isOpen, onClose, certificate }) => {
  const [directPdfAllowed, setDirectPdfAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add('modal-open');
    let active = true;
    getPublicCloudinaryStatus()
      .then((status) => {
        if (!active) return;
        if (typeof status.directPdfAllowed === 'boolean') {
          setDirectPdfAllowed(status.directPdfAllowed);
        }
      })
      .catch(() => {});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      active = false;
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !certificate) return null;

  const certItem = certificate as CertificateItem;
  const previewUrl = resolvePlayablePdfUrl(certificate.driveLink, {
    directPdfAllowed,
    cloudinaryUrl: certItem.cloudinaryUrl,
    fileName: certificate.title,
    download: false,
    forIframeEmbed: true,
  });
  const directViewUrl = resolvePlayablePdfUrl(certificate.driveLink, {
    directPdfAllowed,
    cloudinaryUrl: certItem.cloudinaryUrl,
    fileName: certificate.title,
    download: false,
    forIframeEmbed: false,
  });
  const downloadUrl = resolvePlayablePdfUrl(certificate.driveLink, {
    directPdfAllowed,
    cloudinaryUrl: certItem.cloudinaryUrl,
    fileName: certificate.title,
    download: true,
  });

  return (
    <div
      id="pdfModal"
      className="pdf-modal active"
      role="dialog"
      aria-modal="true"
      aria-label={`PDF Preview for ${certificate.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pdf-modal-backdrop" onClick={onClose}></div>
      <div className="pdf-modal-box">
        <div className="pdf-modal-header">
          <div className="pdf-modal-title-wrap">
            <i className="fas fa-file-pdf" style={{ color: '#ef4444', fontSize: '18px' }}></i>
            <span className="pdf-modal-title">{certificate.title}</span>
            <span className="pdf-modal-badge">PDF Document</span>
          </div>

          <div className="pdf-modal-actions">
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pdf-action-btn"
                title="Download PDF"
              >
                <i className="fas fa-download"></i>
                <span>Download</span>
              </a>
            )}
            {directViewUrl && (
              <a
                href={directViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pdf-action-btn"
                title="Open PDF in New Tab"
              >
                <i className="fas fa-external-link-alt"></i>
                <span>Open PDF</span>
              </a>
            )}
            <button
              type="button"
              className="pdf-modal-close"
              onClick={onClose}
              aria-label="Close PDF viewer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="pdf-modal-body">
          <iframe
            key={previewUrl}
            src={previewUrl}
            title={certificate.title}
            className="pdf-modal-iframe"
            allow="autoplay"
          ></iframe>
        </div>
      </div>
    </div>
  );
};
