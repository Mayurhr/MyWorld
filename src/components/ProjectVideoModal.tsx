import React, { useEffect, useRef } from 'react';

interface ProjectVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoSrc: string;
  title: string;
}

export const ProjectVideoModal: React.FC<ProjectVideoModalProps> = ({
  isOpen,
  onClose,
  videoSrc,
  title,
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
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizedSrc = videoSrc.startsWith('/') || videoSrc.startsWith('http')
    ? videoSrc
    : `/${videoSrc}`;

  return (
    <div
      id="projectVideoModal"
      className="project-video-modal active"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="project-video-box">
        <button
          type="button"
          className="close-project-video"
          onClick={handleClose}
          aria-label="Close project video"
        >
          <i className="fas fa-times"></i>
        </button>

        <h3 id="videoProjectTitle">{title}</h3>

        <video
          ref={videoRef}
          id="projectVideo"
          src={normalizedSrc}
          controls
          autoPlay
          playsInline
          style={{
            width: '100%',
            maxHeight: '75vh',
            borderRadius: '14px',
            backgroundColor: '#000',
            display: 'block',
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};
