import React, { useState, useEffect, useRef } from 'react';
import { Certificate } from '../types';
import { getGoogleDriveImageFallbacks } from '../utils/drive';

interface FullscreenImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificates: Certificate[];
  initialIndex: number;
  showNavigation?: boolean;
}

export const FullscreenImageModal: React.FC<FullscreenImageModalProps> = ({
  isOpen,
  onClose,
  certificates,
  initialIndex,
  showNavigation,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStartRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setFallbackIndex(0);
    resetTransform();
  }, [initialIndex, isOpen]);

  const resetTransform = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const currentCert = certificates[currentIndex];
  const fallbacks = currentCert ? getGoogleDriveImageFallbacks(currentCert.driveLink, 2500) : [];
  const imageSrc = fallbacks[fallbackIndex] || (currentCert ? currentCert.driveLink : '');

  // Navigation is only enabled if explicitly permitted AND the certificate is an achievement item
  const canNavigate = Boolean(
    (showNavigation ?? Boolean(currentCert?.viewAchievement)) && certificates.length > 1
  );

  const navigate = (direction: number) => {
    if (!canNavigate || !certificates.length) return;
    setCurrentIndex((prev) => (prev + direction + certificates.length) % certificates.length);
    setFallbackIndex(0);
    resetTransform();
  };

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add('modal-open');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && canNavigate) {
        navigate(-1);
      } else if (e.key === 'ArrowRight' && canNavigate) {
        navigate(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, canNavigate, certificates.length]);

  if (!isOpen || !currentCert) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * zoomFactor, 1), 4);

    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const worldX = (offsetX - position.x) / scale;
      const worldY = (offsetY - position.y) / scale;

      setScale(newScale);
      setPosition({
        x: offsetX - worldX * newScale,
        y: offsetY - worldY * newScale,
      });
    } else {
      setScale(newScale);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!canNavigate) return;
    const touchEndX = e.changedTouches[0].screenX;
    const swipeThreshold = 55;
    if (touchEndX < touchStartRef.current - swipeThreshold) {
      navigate(1);
    } else if (touchEndX > touchStartRef.current + swipeThreshold) {
      navigate(-1);
    }
  };

  return (
    <div
      id="modal"
      className="modal"
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="modal-header">
        <div className="modal-title-bar">
          <span className="modal-cert-title">{currentCert.title}</span>
        </div>
        <button id="closeModal" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="modal-content" onWheel={handleWheel}>
        <img
          ref={imgRef}
          id="imageViewer"
          key={imageSrc}
          src={imageSrc}
          alt={currentCert.title}
          draggable="false"
          referrerPolicy="no-referrer"
          onError={() => {
            if (fallbackIndex < fallbacks.length - 1) {
              setFallbackIndex((prev) => prev + 1);
            }
          }}
          onMouseDown={handleMouseDown}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            transition: isDragging ? 'none' : 'transform 0.1s ease',
          }}
        />
      </div>

      {canNavigate && (
        <>
          <button
            type="button"
            className="modal-nav-btn prev"
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }}
            aria-label="Previous Certificate"
          >
            ❮
          </button>
          <button
            type="button"
            className="modal-nav-btn next"
            onClick={(e) => {
              e.stopPropagation();
              navigate(1);
            }}
            aria-label="Next Certificate"
          >
            ❯
          </button>
        </>
      )}
    </div>
  );
};
