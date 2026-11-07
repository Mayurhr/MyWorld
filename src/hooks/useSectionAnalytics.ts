import { useEffect, useRef } from 'react';
import { analytics } from '../services/analytics';

/**
 * Automatically tracks section views when a visitor scrolls through and spends
 * meaningful attention (>1.5s) on each portfolio section.
 */
export function useSectionAnalytics(sectionIds: string[]) {
  const viewedSectionsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const sectionId = entry.target.id;
          if (!sectionId) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            // Set a timer to ensure visitor is actually looking at the section for 1.5s
            if (!timersRef.current.has(sectionId) && !viewedSectionsRef.current.has(sectionId)) {
              const timer = setTimeout(() => {
                viewedSectionsRef.current.add(sectionId);
                analytics.trackSectionView(sectionId);
              }, 1500);
              timersRef.current.set(sectionId, timer);
            }
          } else {
            // Cancel timer if user just scrolled quickly past
            if (timersRef.current.has(sectionId)) {
              clearTimeout(timersRef.current.get(sectionId));
              timersRef.current.delete(sectionId);
            }
          }
        });
      },
      {
        threshold: [0.3, 0.6],
        rootMargin: '-50px 0px -50px 0px',
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [sectionIds]);
}
