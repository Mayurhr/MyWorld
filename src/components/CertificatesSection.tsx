import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Certificate } from '../types';
import { DriveImage } from './DriveImage';
import { getCertificateBadgeLabel } from '../utils/drive';
import { getHomepageCertificates, getMobileHomepageCertificates } from '../services/certificateService';

interface CertificatesSectionProps {
  certificates: Certificate[];
  onSelectCertificate: (cert: Certificate) => void;
  onViewAll?: () => void;
}

const isMobileViewport = (): boolean =>
  typeof window !== 'undefined' && window.innerWidth < 768;

const getDesktopOrTabletLimit = (): number => {
  if (typeof window === 'undefined') return 9;
  const width = window.innerWidth;
  if (width >= 768 && width < 1024) {
    return 8;
  }
  return 9;
};

export const CertificatesSection: React.FC<CertificatesSectionProps> = ({
  certificates,
  onSelectCertificate,
  onViewAll,
}) => {
  const [isMobile, setIsMobile] = useState<boolean>(isMobileViewport);
  const [displayLimit, setDisplayLimit] = useState<number>(getDesktopOrTabletLimit);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileViewport());
      setDisplayLimit(getDesktopOrTabletLimit());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayCertificates = isMobile
    ? getMobileHomepageCertificates(certificates)
    : getHomepageCertificates(certificates).slice(0, displayLimit);

  return (
    <section id="certificates">
      <section id="certificates-sub" aria-label="certificates">
        <article className="certficates active" data-page="certficates">
          <header>
            <h2 className="h2 article-title">Certificates</h2>
            <br />
          </header>

          <div id="featuredCertificateContainer" className="certificate-grid">
            {displayCertificates.map((cert, index) => (
              <div
                key={`${cert.title}-${index}`}
                className="certificate-card highlighted-certificate"
                tabIndex={0}
                role="button"
                aria-label={`View ${cert.viewAchievement ? 'achievement' : 'certificate'} for ${cert.title}`}
                onClick={() => onSelectCertificate(cert)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCertificate(cert);
                  }
                }}
              >
                <div className="highlight-badge">
                  {getCertificateBadgeLabel(cert.category)}
                </div>

                {cert.featured && (
                  <div className="featured-indicator-badge" title="Featured Certificate">
                    <i className="fas fa-star" aria-hidden="true"></i>
                    <span>Featured</span>
                  </div>
                )}

                <DriveImage
                  driveUrl={cert.driveLink}
                  alt={cert.title}
                  className="certificate-thumb"
                />

                <div className="certificate-title">{cert.title}</div>

                <div className="certificate-info-row">
                  <span className="cert-card-issuer">{cert.issuer}</span>
                  <span className="cert-card-year">{cert.year}</span>
                </div>

                {cert.viewAchievement && (
                  <div className="view-achievement-hint">
                    View Achievement <i className="fas fa-arrow-right"></i>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="view-all-wrapper">
            <Link
              to="/certificates"
              className="view-all-btn"
              onClick={(e) => {
                if (onViewAll) {
                  e.preventDefault();
                  onViewAll();
                }
              }}
              aria-label="View All Certificates"
            >
              <span>View All Certificates</span>
              <i className="fas fa-arrow-right" aria-hidden="true"></i>
            </Link>
          </div>
        </article>
      </section>
    </section>
  );
};
