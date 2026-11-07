import React, { useEffect, useState } from 'react';
import { useResume } from '../hooks/useResume';
import { analytics } from '../services/analytics';
import {
  getPublicCloudinaryStatus,
  isCloudinaryUrl,
  resolvePlayablePdfUrl,
} from '../utils/drive';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_RESUME_FILE_ID = '1mQIj4WNOSE7aTStKP8wON80vGggYgZeY';

export const ResumeModal: React.FC<ResumeModalProps> = ({ isOpen, onClose }) => {
  const { resume } = useResume();
  const [directPdfAllowed, setDirectPdfAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    analytics.trackResumeView();

    let active = true;
    getPublicCloudinaryStatus()
      .then((status) => {
        if (!active) return;
        if (typeof status.directPdfAllowed === 'boolean') {
          setDirectPdfAllowed(status.directPdfAllowed);
        } else if (typeof resume?.directPdfDelivery === 'boolean') {
          setDirectPdfAllowed(resume.directPdfDelivery);
        }
      })
      .catch(() => {});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, resume?.directPdfDelivery]);

  if (!isOpen) return null;

  const defaultPreviewUrl = `https://drive.google.com/file/d/${DEFAULT_RESUME_FILE_ID}/preview`;
  const defaultDownloadUrl = `https://drive.google.com/uc?export=download&id=${DEFAULT_RESUME_FILE_ID}`;

  const rawPreviewSource =
    directPdfAllowed === true && resume?.cloudinaryUrl
      ? resume.cloudinaryUrl
      : resume?.resumePdfUrl || defaultPreviewUrl;

  const previewUrl = resolvePlayablePdfUrl(rawPreviewSource, {
    directPdfAllowed,
    cloudinaryUrl: resume?.cloudinaryUrl,
    fileName: resume?.fileName,
    download: false,
    forIframeEmbed: true,
  });

  const viewUrl = resolvePlayablePdfUrl(rawPreviewSource, {
    directPdfAllowed,
    cloudinaryUrl: resume?.cloudinaryUrl,
    fileName: resume?.fileName,
    download: false,
    forIframeEmbed: false,
  });

  const rawDownloadSource =
    directPdfAllowed === true && resume?.cloudinaryUrl
      ? resume.cloudinaryUrl
      : resume?.downloadUrl || resume?.resumePdfUrl || defaultDownloadUrl;

  const downloadUrl = resolvePlayablePdfUrl(rawDownloadSource, {
    directPdfAllowed,
    cloudinaryUrl: resume?.cloudinaryUrl,
    fileName: resume?.fileName,
    download: true,
  });

  const usesDirectOrBridgeAttachment =
    (isCloudinaryUrl(downloadUrl) && downloadUrl.includes('/fl_attachment')) ||
    downloadUrl.includes('/api/public/cloudinary/pdf');

  return (
    <div
      id="resumeModal"
      className="resume-modal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="resume-modal-content">
        <button
          type="button"
          className="resume-close"
          onClick={onClose}
          aria-label="Close Resume"
        >
          <ion-icon name="close-outline"></ion-icon>
        </button>

        <h2>My Resume</h2>

        <iframe
          id="resumeFrame"
          key={previewUrl}
          src={previewUrl}
          width="100%"
          height="550"
          title="Mayur H R Resume"
        />

        <div className="resume-actions">
          <a
            id="previewResumeBtn"
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => analytics.trackResumeView()}
          >
            View PDF
          </a>

          <a
            id="downloadResumeBtn"
            href={downloadUrl}
            {...(!usesDirectOrBridgeAttachment
              ? { download: resume?.fileName || 'Mayur_H_R_Resume.pdf' }
              : {})}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => analytics.trackResumeDownload()}
          >
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
};
