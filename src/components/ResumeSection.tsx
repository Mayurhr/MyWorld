import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQualifications } from '../hooks/useQualifications';

export const ResumeSection: React.FC = () => {
  const { qualifications } = useQualifications();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [inViewIds, setInViewIds] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Sort qualifications to ensure exact order: SSLC (1), PUC (2), B.E. (3)
  const sortedQualifications = [...qualifications].sort((a, b) => {
    // Priority order: SSLC (order 1), PUC (order 2), B.E. (order 3)
    const getOrderPriority = (q: typeof a) => {
      const name = (q.degree + ' ' + q.institution).toLowerCase();
      if (name.includes('sslc') || name.includes('swamy') || name.includes('s.v.m.e')) return 1;
      if (name.includes('puc') || name.includes('pre-university') || name.includes('sri vijaya')) return 2;
      if (name.includes('bachelor') || name.includes('b.e') || name.includes('pes')) return 3;
      return q.order || 99;
    };
    return getOrderPriority(a) - getOrderPriority(b);
  });

  // Calculate progressive scroll-drawing for the central timeline line
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Start drawing as the top of container reaches 75% down viewport, complete near top
    const startPoint = windowHeight * 0.75;
    const totalDistance = rect.height + windowHeight * 0.35;
    const currentDistance = startPoint - rect.top;

    const rawProgress = currentDistance / totalDistance;
    const clampedProgress = Math.min(Math.max(rawProgress, 0), 1);
    setScrollProgress(clampedProgress);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setScrollProgress(1);
      setInViewIds(new Set(sortedQualifications.map((q) => q.id)));
      return;
    }

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    handleScroll();

    // Intersection observer to trigger card entrance and connection
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-id');
            if (id) {
              setInViewIds((prev) => new Set(prev).add(id));
            }
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observer.disconnect();
    };
  }, [sortedQualifications, handleScroll]);

  // Clean full institution names for display
  const getFullInstitutionName = (name: string) => {
    if (name.includes('PES')) {
      return 'PES Institute of Technology and Management';
    }
    if (name.includes('Sri Vijaya')) {
      return 'Sri Vijaya PU College';
    }
    if (name.includes('S.V.M.E') || name.includes('Swamy Vivekananda')) {
      return 'Swamy Vivekananda Memorial English School';
    }
    return name;
  };

  const total = sortedQualifications.length;

  return (
    <section id="resume">
      <section id="resume-sub" aria-label="Academic Background">
        <article className="resume active" data-page="resume">
          <header>
            <h2 className="h2 article-title">Academic Background</h2>
          </header>
          <br />

          <div
            className="academic-timeline-container"
            ref={containerRef}
            aria-label="Academic milestones timeline"
          >
            {/* Base timeline spine line (subtle background track) */}
            <div className="academic-timeline-spine-track" aria-hidden="true"></div>

            {/* Progressively drawn connecting central line that fills as user scrolls */}
            <div
              className="academic-timeline-spine-progress"
              style={{ height: `${(scrollProgress * 100).toFixed(1)}%` }}
              aria-hidden="true"
            >
              <div className="academic-timeline-spine-glow-tip"></div>
            </div>

            <div className="academic-timeline-entries">
              {sortedQualifications.map((q, idx) => {
                // Strict Alternating:
                // idx 0: LEFT  (SSLC)
                // idx 1: RIGHT (PUC)
                // idx 2: LEFT  (B.E.)
                const isLeft = idx % 2 === 0;

                // Threshold where the line reaches this milestone node
                const milestoneThreshold = total > 0 ? (idx + 0.15) / total : 0;
                const isNodeActive = inViewIds.has(q.id) || scrollProgress >= milestoneThreshold;
                const isInView = inViewIds.has(q.id) || scrollProgress >= milestoneThreshold;

                const durationText = `${q.startYear} – ${q.endYear}`;

                return (
                  <div
                    key={q.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(q.id, el);
                    }}
                    data-id={q.id}
                    className={`academic-entry ${isLeft ? 'entry-left' : 'entry-right'} ${
                      isInView ? 'in-view' : ''
                    } ${isNodeActive ? 'node-illuminated' : ''}`}
                    style={{ '--entry-index': idx } as React.CSSProperties}
                  >
                    {/* Glowing Circular Timeline Center Node */}
                    <div className="academic-node" aria-hidden="true">
                      <div className="academic-node-halo"></div>
                      <span className="academic-node-dot"></span>
                    </div>

                    {/* Desktop Duration Label positioned beside the central node */}
                    <div
                      className={`academic-node-date-tag ${
                        isLeft ? 'node-date-right' : 'node-date-left'
                      }`}
                      aria-hidden="true"
                    >
                      <i className="far fa-calendar-alt"></i>
                      <span>{durationText}</span>
                    </div>

                    {/* Timeline Connector Arm linking card to the central dot */}
                    <div className="academic-connector-arm" aria-hidden="true">
                      <div className="academic-connector-arm-fill"></div>
                    </div>

                    {/* Education Milestone Card */}
                    <div className="academic-card">
                      <div className="academic-card-header">
                        <span className="academic-duration">
                          <i className="far fa-calendar-alt" aria-hidden="true"></i>
                          <span>{durationText}</span>
                        </span>

                        {q.grade && (
                          <span className="academic-grade-badge">
                            <i className="fas fa-award" aria-hidden="true"></i>
                            <span>{q.grade}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="academic-degree">{q.degree}</h3>

                      <div className="academic-institution">
                        <i className="fas fa-university" aria-hidden="true"></i>
                        <span className="institution-name">{getFullInstitutionName(q.institution)}</span>
                        {q.location && <span className="institution-loc"> • {q.location}</span>}
                      </div>

                      {q.specialization && (
                        <div className="academic-specialization">
                          <span className="spec-label">Specialization:</span>{' '}
                          <strong className="spec-value">{q.specialization}</strong>
                        </div>
                      )}

                      {q.description && (
                        <div className="academic-description">
                          {q.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
};
