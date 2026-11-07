import React, { useState, useEffect } from 'react';
import { getGoogleDriveImageFallbacks } from '../utils/drive';

interface QuickImageOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  items: string[];
  initialIndex?: number;
}

export const QuickImageOverlay: React.FC<QuickImageOverlayProps> = ({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setFallbackIndex(0);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        e.stopImmediatePropagation();
      } else if (e.key === 'ArrowLeft' && items.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
        setFallbackIndex(0);
        e.stopImmediatePropagation();
      } else if (e.key === 'ArrowRight' && items.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % items.length);
        setFallbackIndex(0);
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, items.length, onClose]);

  if (!isOpen || !items.length) return null;

  const currentItem = items[currentIndex];
  const fallbacks = getGoogleDriveImageFallbacks(currentItem, 2500);
  const src = fallbacks[fallbackIndex] || currentItem;

  return (
    <div
      id="quickImageOverlay"
      className="quick-image-overlay"
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="quick-image-close"
        aria-label="Close enlarged image"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="quick-image-nav quick-image-prev"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
              setFallbackIndex(0);
            }}
          >
            &#8249;
          </button>

          <button
            type="button"
            className="quick-image-nav quick-image-next"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((prev) => (prev + 1) % items.length);
              setFallbackIndex(0);
            }}
          >
            &#8250;
          </button>

          <div className="quick-image-counter" aria-live="polite">
            {currentIndex + 1} / {items.length}
          </div>
        </>
      )}

      <img
        id="quickImageOverlayImg"
        key={src}
        src={src}
        alt="Enlarged view"
        referrerPolicy="no-referrer"
        onError={() => {
          if (fallbackIndex < fallbacks.length - 1) {
            setFallbackIndex((prev) => prev + 1);
          }
        }}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
};
