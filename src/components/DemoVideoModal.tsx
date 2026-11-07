import React, { useEffect, useRef } from 'react';
import { getEmbedInfo } from '../utils/drive';

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
}

export const DemoVideoModal: React.FC<DemoVideoModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title = 'Demo Video',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add('modal-open');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || !videoUrl) return null;

  const embedInfo = getEmbedInfo(videoUrl);

  return (
    <div
      id="demoVideoModal"
      className="demo-video-modal"
      role="dialog"
      aria-modal="true"
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="demo-video-backdrop" onClick={handleClose}></div>
      <div className="demo-video-box">
        <div className="demo-video-header">
          <span>{title}</span>
          <button
            type="button"
            className="demo-video-close"
            aria-label="Close demo video"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>
        <div className="demo-video-body" id="demoVideoBody">
          {embedInfo?.type === 'video' ? (
            <video ref={videoRef} src={embedInfo.src} controls autoPlay playsInline />
          ) : embedInfo ? (
            <iframe
              src={embedInfo.src}
              title={title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <p style={{ color: '#fff', padding: '20px', textAlign: 'center' }}>
              Video preview not available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
