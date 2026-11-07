import React, { useState, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { analytics } from '../services/analytics';
import { Project } from '../types';

interface ProjectsSectionProps {
  onOpenVideo: (videoSrc: string, title: string) => void;
}

function slugifyProjectTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ onOpenVideo }) => {
  const { projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!selectedProject) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProject(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProject]);

  const handleOpenProjectDetail = (project: Project) => {
    analytics.trackProjectInteraction(project.title, 'view');
    setSelectedProject(project);
  };

  return (
    <section id="projects">
      <section id="projects-sub" aria-label="Projects">
        <article className="projects active" data-page="projects">
          <header>
            <h2 className="h2 article-title">My Projects</h2>
          </header>
          <br />

          <div className="projects-grid">
            {projects.map((project, index) => {
              const displayDescription = project.cardDescription || project.description;
              const displayTech =
                project.cardTech && project.cardTech.length > 0
                  ? project.cardTech
                  : project.tech;
              const projectSlug = slugifyProjectTitle(project.title);

              return (
                <div
                  key={project.id || index}
                  id={`project-${projectSlug}`}
                  className="project-card"
                  data-category={project.category}
                  onClick={() => handleOpenProjectDetail(project)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect ${project.title} details`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenProjectDetail(project);
                    }
                  }}
                >
                  <div className="project-image">
                    <img src={project.image} alt={project.title} loading="lazy" />
                    <span className="project-category-badge">
                      {project.category === 'ai' ? 'AI' : 'WEB'}
                    </span>
                    <div className="project-overlay">
                      <div className="project-links">
                        {project.github && (
                          <a
                            href={project.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="project-link"
                            aria-label={`${project.title} GitHub`}
                            onClick={(e) => {
                              e.stopPropagation();
                              analytics.trackProjectInteraction(project.title, 'github');
                            }}
                          >
                            <i className="fab fa-github"></i>
                            <span className="project-link-tooltip">GitHub</span>
                          </a>
                        )}

                        {project.demo && (
                          <a
                            href={project.demo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="project-link live-demo-link"
                            aria-label={`${project.title} Live Demo`}
                            onClick={(e) => {
                              e.stopPropagation();
                              analytics.trackProjectInteraction(project.title, 'live');
                            }}
                          >
                            <i className="fas fa-globe" aria-hidden="true"></i>
                            <span className="project-link-tooltip">Live Demo</span>
                          </a>
                        )}

                        {project.videoDemo && (
                          <button
                            type="button"
                            className="project-link preview-btn"
                            aria-label={`${project.title} Project Demo`}
                            onClick={(e) => {
                              e.stopPropagation();
                              analytics.trackProjectInteraction(project.title, 'video');
                              onOpenVideo(project.videoDemo!, project.title);
                            }}
                          >
                            <i className="fas fa-play"></i>
                            <span className="project-link-tooltip">Project Demo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="project-content">
                    <h3 className="project-title" title={project.title}>{project.title}</h3>
                    <p className="project-description">{displayDescription}</p>
                    <div className="project-tech">
                      {displayTech.slice(0, 3).map((t, idx) => (
                        <span key={idx} className="tech-tag">
                          {t}
                        </span>
                      ))}
                      {displayTech.length > 3 && (
                        <span className="tech-tag-more">+{displayTech.length - 3}</span>
                      )}
                    </div>

                    {/* Direct accessible action buttons for touch & mobile */}
                    <div className="project-card-actions">
                      {project.demo && (
                        <a
                          href={project.demo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="project-card-btn live-btn"
                          aria-label={`${project.title} Live Demo`}
                          onClick={(e) => {
                            e.stopPropagation();
                            analytics.trackProjectInteraction(project.title, 'live');
                          }}
                        >
                          <i className="fas fa-globe" aria-hidden="true"></i>
                          <span>Live</span>
                        </a>
                      )}
                      {project.github && (
                        <a
                          href={project.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="project-card-btn github-btn"
                          aria-label={`${project.title} GitHub`}
                          onClick={(e) => {
                            e.stopPropagation();
                            analytics.trackProjectInteraction(project.title, 'github');
                          }}
                        >
                          <i className="fab fa-github" aria-hidden="true"></i>
                          <span>GitHub</span>
                        </a>
                      )}
                      {project.videoDemo && (
                        <button
                          type="button"
                          className="project-card-btn video-btn"
                          aria-label={`${project.title} Demo Video`}
                          onClick={(e) => {
                            e.stopPropagation();
                            analytics.trackProjectInteraction(project.title, 'video');
                            onOpenVideo(project.videoDemo!, project.title);
                          }}
                        >
                          <i className="fas fa-play" aria-hidden="true"></i>
                          <span>Demo</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      {/* Project Detail Modal preserving complete description, features, and verified stack */}
      {selectedProject && (
        <div
          className="project-detail-backdrop"
          onClick={() => setSelectedProject(null)}
          role="presentation"
        >
          <div
            className="project-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-detail-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="project-detail-close"
              onClick={() => setSelectedProject(null)}
              aria-label="Close project details"
            >
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>

            <div className="project-detail-banner">
              <img src={selectedProject.image} alt={selectedProject.title} />
              <span className="project-detail-category-badge">
                {selectedProject.category.toUpperCase()}
              </span>
            </div>

            <div className="project-detail-body">
              <h3 id="project-detail-modal-title" className="project-detail-title">
                {selectedProject.title}
              </h3>

              <div className="project-detail-section">
                <h4 className="project-detail-subheading">Project Overview</h4>
                <p className="project-detail-full-desc">{selectedProject.description}</p>
              </div>

              {selectedProject.features && selectedProject.features.length > 0 && (
                <div className="project-detail-section">
                  <h4 className="project-detail-subheading">Key Capabilities</h4>
                  <ul className="project-detail-features">
                    {selectedProject.features.map((feat, idx) => (
                      <li key={idx}>
                        <i className="fas fa-check-circle" aria-hidden="true"></i>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="project-detail-section">
                <h4 className="project-detail-subheading">Complete Technology Stack</h4>
                <div className="project-detail-tech-list">
                  {selectedProject.tech.map((t, idx) => (
                    <span key={idx} className="tech-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {(selectedProject.github || selectedProject.demo || selectedProject.videoDemo) && (
                <div className="project-detail-actions">
                  {selectedProject.demo && (
                    <a
                      href={selectedProject.demo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-detail-btn primary"
                      onClick={() =>
                        analytics.trackProjectInteraction(selectedProject.title, 'live')
                      }
                    >
                      <i className="fas fa-globe" aria-hidden="true"></i>
                      <span>Live Demo</span>
                    </a>
                  )}

                  {selectedProject.github && (
                    <a
                      href={selectedProject.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-detail-btn secondary"
                      onClick={() =>
                        analytics.trackProjectInteraction(selectedProject.title, 'github')
                      }
                    >
                      <i className="fab fa-github" aria-hidden="true"></i>
                      <span>GitHub Repository</span>
                    </a>
                  )}

                  {selectedProject.videoDemo && (
                    <button
                      type="button"
                      className="project-detail-btn secondary"
                      onClick={() => {
                        const videoSrc = selectedProject.videoDemo!;
                        const title = selectedProject.title;
                        setSelectedProject(null);
                        analytics.trackProjectInteraction(title, 'video');
                        onOpenVideo(videoSrc, title);
                      }}
                    >
                      <i className="fas fa-play" aria-hidden="true"></i>
                      <span>Watch Demo Video</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
