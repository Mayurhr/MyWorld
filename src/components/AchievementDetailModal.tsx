import React, { useState, useEffect } from 'react';
import { Certificate } from '../types';
import { DriveImage } from './DriveImage';
import { getCertificateBadgeLabel, getGoogleDriveImageUrl, isPdfCertificate } from '../utils/drive';

interface AchievementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate | null;
  onOpenQuickOverlay: (items: string[], index: number) => void;
  onOpenDemoVideo: (url: string, title?: string) => void;
  onOpenPdf?: (cert: Certificate) => void;
}

export const AchievementDetailModal: React.FC<AchievementDetailModalProps> = ({
  isOpen,
  onClose,
  certificate,
  onOpenQuickOverlay,
  onOpenDemoVideo,
  onOpenPdf,
}) => {
  const [spotlightPhoto, setSpotlightPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSpotlightPhoto(null);
      return;
    }

    document.body.classList.add('modal-open');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !certificate) return null;

  const achievement = certificate.achievement || {};
  const isFeatured = certificate.featured === true;
  const experienceText = achievement.experience || '';
  const hasExperience = Boolean(experienceText.trim().length > 0);

  const eventPhotos = Array.isArray(achievement.eventPhotos) ? achievement.eventPhotos.filter(Boolean) : [];
  const hasEventPhotos = eventPhotos.length > 0;

  // Build full gallery: certificate main image first, followed by all event photos
  const allMediaItems: string[] = [
    getGoogleDriveImageUrl(certificate.driveLink, 2000),
    ...eventPhotos.map((p) => getGoogleDriveImageUrl(p, 2000)),
  ];

  const renderExperienceHTML = (text: string) => {
    // Split by **text** to render bold highlight spans safely preserving all text
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="achievement-highlight">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  const marqueeDuration = Math.max(eventPhotos.length * 6, 18);

  return (
    <div
      id="achievementModal"
      className="achievement-modal"
      role="dialog"
      aria-modal="true"
      aria-hidden="false"
    >
      <div className="achievement-backdrop" onClick={onClose}></div>
      <div className="achievement-panel">
        <div className="achievement-panel-header">
          <button
            type="button"
            className="achievement-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="achievement-panel-body" id="achievementBody">
          {/* Media column */}
          <div className="achievement-media">
            <div
              className={`achievement-cert-frame ${spotlightPhoto ? 'is-photo-preview-active' : ''}`}
              id="achievementCertFrame"
            >
              {/* Spotlight overlay for hovered event photo */}
              <div
                className={`achievement-gallery-spotlight ${spotlightPhoto ? 'is-visible' : ''}`}
                aria-hidden={!spotlightPhoto}
              >
                <div className="achievement-gallery-spotlight-stage">
                  {spotlightPhoto && (
                    <img
                      className="achievement-gallery-spotlight-img"
                      src={spotlightPhoto}
                      alt="Event Spotlight"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>

              {/* Certificate image with Drive loader */}
              <DriveImage
                driveUrl={certificate.driveLink}
                alt={certificate.title}
                className="achievement-cert-img"
                wrapperClassName="achievement-cert-img-wrapper"
                size={1600}
                onClick={() => {
                  if (isPdfCertificate(certificate.driveLink) && onOpenPdf) {
                    onOpenPdf(certificate);
                  } else {
                    onOpenQuickOverlay(allMediaItems, 0);
                  }
                }}
              />

              <button
                type="button"
                className="achievement-enlarge-btn"
                aria-label={
                  isPdfCertificate(certificate.driveLink)
                    ? `Open PDF Document for ${certificate.title}`
                    : `Expand ${certificate.title}`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPdfCertificate(certificate.driveLink) && onOpenPdf) {
                    onOpenPdf(certificate);
                  } else {
                    onOpenQuickOverlay(allMediaItems, 0);
                  }
                }}
              >
                <i
                  className={
                    isPdfCertificate(certificate.driveLink)
                      ? 'fas fa-file-pdf'
                      : 'fas fa-expand'
                  }
                ></i>
              </button>
            </div>

            {/* Event Photos Section */}
            {hasEventPhotos && (
              <div className="achievement-section achievement-gallery-section">
                <div className="achievement-section-header">
                  <h3 className="achievement-section-title">
                    Event Moments <span className="achievement-photo-count">({eventPhotos.length})</span>
                  </h3>
                </div>

                <div
                  className={`achievement-gallery-marquee ${spotlightPhoto ? 'is-photo-hovered' : ''}`}
                >
                  <div
                    className="achievement-gallery-track"
                    style={{ animationDuration: `${marqueeDuration}s` }}
                  >
                    {/* First pass */}
                    {eventPhotos.map((photoUrl, i) => {
                      const fullPhotoUrl = getGoogleDriveImageUrl(photoUrl, 1600);
                      return (
                        <div
                          key={`photo-a-${i}`}
                          className="achievement-gallery-photo"
                          tabIndex={0}
                          role="button"
                          aria-label={`Preview event photo ${i + 1}`}
                          onPointerEnter={(e) => {
                            if (e.pointerType && e.pointerType !== 'mouse') return;
                            setSpotlightPhoto(fullPhotoUrl);
                          }}
                          onPointerLeave={(e) => {
                            if (e.pointerType && e.pointerType !== 'mouse') return;
                            setSpotlightPhoto(null);
                          }}
                          onFocus={() => setSpotlightPhoto(fullPhotoUrl)}
                          onBlur={() => setSpotlightPhoto(null)}
                          onClick={() => onOpenQuickOverlay(allMediaItems, i + 1)}
                        >
                          <DriveImage
                            driveUrl={photoUrl}
                            alt={`Event photo ${i + 1}`}
                            className="achievement-gallery-thumb"
                            size={400}
                          />
                        </div>
                      );
                    })}

                    {/* Duplicate pass for seamless marquee looping */}
                    {eventPhotos.map((photoUrl, i) => {
                      const fullPhotoUrl = getGoogleDriveImageUrl(photoUrl, 1600);
                      return (
                        <div
                          key={`photo-b-${i}`}
                          className="achievement-gallery-photo"
                          aria-hidden="true"
                          tabIndex={-1}
                          onPointerEnter={(e) => {
                            if (e.pointerType && e.pointerType !== 'mouse') return;
                            setSpotlightPhoto(fullPhotoUrl);
                          }}
                          onPointerLeave={(e) => {
                            if (e.pointerType && e.pointerType !== 'mouse') return;
                            setSpotlightPhoto(null);
                          }}
                          onClick={() => onOpenQuickOverlay(allMediaItems, i + 1)}
                        >
                          <DriveImage
                            driveUrl={photoUrl}
                            alt={`Event photo ${i + 1}`}
                            className="achievement-gallery-thumb"
                            size={400}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info column */}
          <div className="achievement-info">
            <div className="achievement-heading">
              {Boolean(certificate.category) && (
                <span className="achievement-kicker">
                  {getCertificateBadgeLabel(certificate.category)}
                </span>
              )}
              <h2 className="achievement-title">{certificate.title}</h2>
              <div className="achievement-meta">
                {certificate.issuer && <span>{certificate.issuer}</span>}
                {certificate.year && (
                  <>
                    <span className="achievement-dot">•</span>
                    <span>{certificate.year}</span>
                  </>
                )}
                {certificate.category && (
                  <>
                    <span className="achievement-dot">•</span>
                    <span>{certificate.category}</span>
                  </>
                )}
              </div>
            </div>

            {hasExperience && (
              <div className="achievement-section">
                <h3 className="achievement-section-title">My Experience</h3>
                <p className="achievement-text">
                  {renderExperienceHTML(experienceText)}
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
