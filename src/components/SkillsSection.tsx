import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSkills } from '../hooks/useSkills';

const AUTO_ROTATE_INTERVAL_MS = 5200;
const MANUAL_IDLE_RESUME_MS = 6500;
const TRANSITION_DURATION_MS = 220;

export const SkillsSection: React.FC = () => {
  const { skillCategories } = useSkills();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(0);
  const [isHoverOrFocusPaused, setIsHoverOrFocusPaused] = useState<boolean>(false);
  const [isIdlePaused, setIsIdlePaused] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionDir, setTransitionDir] = useState<'next' | 'prev'>('next');

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = skillCategories.length;

  useEffect(() => {
    if (total > 0 && activeCategoryIndex >= total) {
      setActiveCategoryIndex(0);
    }
  }, [total, activeCategoryIndex]);

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (idleResumeTimerRef.current) clearTimeout(idleResumeTimerRef.current);
    };
  }, []);

  const switchToCategory = useCallback(
    (targetIndex: number, dir: 'next' | 'prev') => {
      if (total <= 1 || targetIndex === activeCategoryIndex) return;

      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        setActiveCategoryIndex(targetIndex);
        setIsTransitioning(false);
        return;
      }

      setTransitionDir(dir);
      setIsTransitioning(true);

      transitionTimerRef.current = setTimeout(() => {
        setActiveCategoryIndex(targetIndex);
        setIsTransitioning(false);
      }, TRANSITION_DURATION_MS);
    },
    [total, activeCategoryIndex]
  );

  const pauseForManualInteraction = useCallback(() => {
    setIsIdlePaused(true);
    if (idleResumeTimerRef.current) {
      clearTimeout(idleResumeTimerRef.current);
    }
    idleResumeTimerRef.current = setTimeout(() => {
      setIsIdlePaused(false);
    }, MANUAL_IDLE_RESUME_MS);
  }, []);

  const handlePrevCategory = () => {
    if (total <= 1) return;
    pauseForManualInteraction();
    const prevIdx = (activeCategoryIndex - 1 + total) % total;
    switchToCategory(prevIdx, 'prev');
  };

  const handleNextCategory = () => {
    if (total <= 1) return;
    pauseForManualInteraction();
    const nextIdx = (activeCategoryIndex + 1) % total;
    switchToCategory(nextIdx, 'next');
  };

  const isPaused = isHoverOrFocusPaused || isIdlePaused;

  // Automatic smooth category rotation across all categories
  useEffect(() => {
    if (total <= 1 || isPaused) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    autoTimerRef.current = setTimeout(() => {
      switchToCategory((activeCategoryIndex + 1) % total, 'next');
    }, AUTO_ROTATE_INTERVAL_MS);

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
      }
    };
  }, [total, activeCategoryIndex, isPaused, switchToCategory]);

  const activeCategory =
    total > 0 && activeCategoryIndex < total
      ? skillCategories[activeCategoryIndex]
      : skillCategories[0] || null;

  if (!activeCategory) return null;

  const prevCatName = skillCategories[(activeCategoryIndex - 1 + total) % total]?.name || 'Previous';
  const nextCatName = skillCategories[(activeCategoryIndex + 1) % total]?.name || 'Next';

  return (
    <section id="skills">
      <section id="skills-sub" aria-label="Technical Skills">
        <article className="skills active" data-page="skills">
          <header>
            <h2 className="h2 article-title">Technical Skills</h2>
          </header>

          <div
            className={`skills-category-showcase-panel dir-${transitionDir}`}
            onMouseEnter={() => setIsHoverOrFocusPaused(true)}
            onMouseLeave={() => setIsHoverOrFocusPaused(false)}
            onFocus={() => setIsHoverOrFocusPaused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setIsHoverOrFocusPaused(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrevCategory();
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNextCategory();
              }
            }}
            tabIndex={0}
            role="region"
            aria-label={`Technical Skills: ${activeCategory.name}`}
          >
            {/* Subtle ambient lighting accent */}
            <div className="skills-ambient-glow" aria-hidden="true"></div>

            {/* Category Showcase Top Bar: Active Category Heading + Prev/Next Controls */}
            <div className="skills-showcase-top-row">
              <div
                className={`skills-category-heading-block ${
                  isTransitioning ? 'heading-exiting' : 'heading-active'
                }`}
              >
                <div className="skills-category-icon-box" aria-hidden="true">
                  <i className={activeCategory.icon || 'fas fa-code'}></i>
                </div>

                <div className="skills-category-title-wrap">
                  <h3 className="skills-category-title">{activeCategory.name}</h3>
                </div>
              </div>

              {total > 1 && (
                <div className="skills-nav-controls" aria-label="Skill category navigation">
                  <button
                    type="button"
                    className="skills-nav-btn skills-nav-prev"
                    onClick={handlePrevCategory}
                    aria-label={`Previous skill category: ${prevCatName}`}
                    title={`Previous: ${prevCatName}`}
                  >
                    <span className="skills-nav-arrow" aria-hidden="true">
                      &#8249;
                    </span>
                  </button>

                  <button
                    type="button"
                    className="skills-nav-btn skills-nav-next"
                    onClick={handleNextCategory}
                    aria-label={`Next skill category: ${nextCatName}`}
                    title={`Next: ${nextCatName}`}
                  >
                    <span className="skills-nav-arrow" aria-hidden="true">
                      &#8250;
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Stationary Skills Collection Grid: All skills in active category stay stationary once revealed */}
            <div
              key={activeCategory.id}
              className={`skills-category-badges-container ${
                isTransitioning ? 'skills-exiting' : 'skills-active'
              }`}
            >
              {activeCategory.skills.map((skill, idx) => (
                <div
                  key={skill.id}
                  className="skill-badge-item"
                  style={{ animationDelay: `${idx * 35}ms` }}
                  title={skill.name}
                >
                  <div className="skill-badge-icon" aria-hidden="true">
                    {skill.icon ? (
                      <i className={skill.icon}></i>
                    ) : (
                      <i className="fas fa-check-circle"></i>
                    )}
                  </div>
                  <span className="skill-badge-name">{skill.name}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
};
