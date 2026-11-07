import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Certificate } from '../types';
import { useCertificates } from '../hooks/useCertificates';
import { sortCertificatesByPriority, isHackathonCertificate } from '../services/certificateService';
import { DriveImage } from '../components/DriveImage';
import { getCertificateBadgeLabel, isPdfCertificate } from '../utils/drive';
import { Sidebar } from '../components/Sidebar';
import { ResumeModal } from '../components/ResumeModal';
import { FullscreenImageModal } from '../components/FullscreenImageModal';
import { AchievementDetailModal } from '../components/AchievementDetailModal';
import { QuickImageOverlay } from '../components/QuickImageOverlay';
import { DemoVideoModal } from '../components/DemoVideoModal';
import { PdfModal } from '../components/PdfModal';

const getResponsiveItemsPerPage = (): number => {
  if (typeof window === 'undefined') return 9;
  const width = window.innerWidth;
  // Mobile/Phone: 2 columns x 2 rows = 4 per page
  if (width < 768) {
    return 4;
  }
  // Tablet: 6 per page
  if (width < 1024) {
    return 6;
  }
  // Laptop/Desktop: 3 columns x 3 rows = 9 per page
  return 9;
};

export const AllCertificates: React.FC = () => {
  const navigate = useNavigate();
  const { certificates, error } = useCertificates();

  // Scroll to top upon landing on page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Responsive pagination layout
  const [itemsPerPage, setItemsPerPage] = useState<number>(getResponsiveItemsPerPage);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(getResponsiveItemsPerPage());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  // Modals state
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [achievementCert, setAchievementCert] = useState<Certificate | null>(null);
  const [pdfCert, setPdfCert] = useState<Certificate | null>(null);

  const [fullscreenModal, setFullscreenModal] = useState<{
    isOpen: boolean;
    certificates: Certificate[];
    initialIndex: number;
  }>({
    isOpen: false,
    certificates: [],
    initialIndex: 0,
  });

  const [quickOverlay, setQuickOverlay] = useState<{
    isOpen: boolean;
    items: string[];
    initialIndex: number;
  }>({
    isOpen: false,
    items: [],
    initialIndex: 0,
  });

  const [demoVideo, setDemoVideo] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: '',
    title: '',
  });

  // Extract unique categories and years
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    certificates.forEach((c) => {
      if (c.category && c.category.trim()) {
        set.add(c.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [certificates]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    certificates.forEach((c) => {
      if (c.year && String(c.year).trim()) {
        set.add(String(c.year).trim());
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [certificates]);

  // Priority-ordered base list (All 49 certificates preserved)
  const prioritySortedCertificates = useMemo(() => {
    return sortCertificatesByPriority(certificates);
  }, [certificates]);

  // Filtered certificates adhering strictly to priority order
  const filteredCertificates = useMemo(() => {
    return prioritySortedCertificates.filter((cert) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = cert.title.toLowerCase().includes(query);
        const issuerMatch = cert.issuer.toLowerCase().includes(query);
        const categoryMatch = cert.category?.toLowerCase().includes(query);
        const descMatch = cert.achievement?.experience?.toLowerCase().includes(query);
        if (!titleMatch && !issuerMatch && !categoryMatch && !descMatch) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'hackathons') {
          if (!isHackathonCertificate(cert)) return false;
        } else if (selectedCategory === 'achievements') {
          if (!cert.viewAchievement) return false;
        } else {
          if (cert.category !== selectedCategory) return false;
        }
      }

      // 3. Year Filter
      if (selectedYear !== 'all') {
        if (String(cert.year).trim() !== selectedYear) return false;
      }

      return true;
    });
  }, [prioritySortedCertificates, searchQuery, selectedCategory, selectedYear]);

  // Reset to page 1 whenever search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedYear]);

  // Total pages calculation based on filtered count
  const totalFiltered = filteredCertificates.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));

  // Guard currentPage within [1, totalPages]
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Paginated slice for current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCertificates = filteredCertificates.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedYear('all');
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
      const container = document.getElementById('allCertificatesContainer');
      if (container) {
        const offset = container.getBoundingClientRect().top + window.pageYOffset - 110;
        window.scrollTo({ top: offset, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 180, behavior: 'smooth' });
      }
    }
  };

  const handleSelectCertificate = (cert: Certificate) => {
    if (cert.viewAchievement === true) {
      setAchievementCert(cert);
    } else if (isPdfCertificate(cert.driveLink)) {
      setPdfCert(cert);
    } else {
      const index = prioritySortedCertificates.findIndex(
        (c) => c.title === cert.title && c.driveLink === cert.driveLink
      );
      setFullscreenModal({
        isOpen: true,
        certificates: prioritySortedCertificates,
        initialIndex: index >= 0 ? index : 0,
      });
    }
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedCategory !== 'all' || selectedYear !== 'all'
  );

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <>
      <main>
        {/* Sidebar */}
        <Sidebar
          currentView="certificates"
          onNavigateHome={() => navigate('/')}
          onOpenResume={() => setIsResumeOpen(true)}
        />

        {/* Main Content Area */}
        <div className="main-content">
          <section id="certificates" className="all-certificates-page">
            <article className="certficates active" data-page="certficates">
              {/* Subpage Header with Back Button and Count */}
              <header className="subpage-header">
                <div className="subpage-title-wrap">
                  <button
                    type="button"
                    className="back-btn"
                    onClick={() => navigate('/')}
                    aria-label="Back to Portfolio"
                  >
                    <i className="fas fa-arrow-left" aria-hidden="true"></i>
                    <span>Back to Portfolio</span>
                  </button>

                  <div className="cert-count-badge" title="Complete Certificate Collection">
                    <i className="fas fa-certificate" aria-hidden="true"></i>
                    <span className="cert-text">Total Certificates</span>
                    <span className="cert-number">{certificates.length}</span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', width: '100%' }}>
                  <h2 className="h2 article-title">All Certificates</h2>
                </div>
              </header>

              {/* Filter & Search Bar */}
              <div id="filters">
                <input
                  type="text"
                  id="searchInput"
                  placeholder="Search certificates by title, issuer, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search certificates"
                />

                <select
                  id="categoryFilter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All Categories</option>
                  <option value="hackathons">🏆 Hackathons</option>
                  <option value="achievements">⭐ View Achievements</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  id="yearFilter"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  aria-label="Filter by year"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button
                    id="clearFilters"
                    type="button"
                    onClick={handleClearFilters}
                    aria-label="Clear all active filters"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Status Row */}
              <div className="cert-status-row">
                <span className="cert-status-text">
                  {totalFiltered > 0 ? (
                    <>
                      Showing <strong>{startIndex + 1}–{Math.min(startIndex + itemsPerPage, totalFiltered)}</strong> of{' '}
                      <strong>{totalFiltered}</strong> certificates
                      {totalPages > 1 && (
                        <> (Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>)</>
                      )}
                    </>
                  ) : (
                    <>Showing <strong>0</strong> certificates</>
                  )}
                  {selectedCategory !== 'all' && (
                    <> • Category: <strong>{selectedCategory}</strong></>
                  )}
                  {selectedYear !== 'all' && (
                    <> • Year: <strong>{selectedYear}</strong></>
                  )}
                  {searchQuery && (
                    <> • Search: <strong>&ldquo;{searchQuery}&rdquo;</strong></>
                  )}
                </span>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className="cert-toggle-btn"
                    onClick={handleClearFilters}
                    aria-label="Reset filters"
                  >
                    <i className="fas fa-undo" aria-hidden="true"></i> Reset Filters
                  </button>
                )}
              </div>

              {/* Error banner */}
              {error && (
                <div className="cert-error-banner">
                  <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Grid or Empty State */}
              {totalFiltered === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--light-gray)' }}>
                  <i className="fas fa-search" style={{ fontSize: '2.5rem', color: 'var(--vegas-gold)', marginBottom: '16px', display: 'inline-block' }}></i>
                  <h3 style={{ color: 'var(--white-1)', fontSize: '1.25rem', marginBottom: '8px' }}>No certificates found</h3>
                  <p style={{ marginBottom: '20px', color: 'var(--light-gray-70)' }}>
                    No certificate matches your current search or filter criteria.
                  </p>
                  <button
                    type="button"
                    className="view-all-btn"
                    onClick={handleClearFilters}
                  >
                    <i className="fas fa-times-circle" aria-hidden="true"></i>
                    <span>Clear All Filters</span>
                  </button>
                </div>
              ) : (
                <>
                  <div
                    id="allCertificatesContainer"
                    className="certificate-grid all-certificates-grid"
                  >
                    {paginatedCertificates.map((cert, index) => (
                      <div
                        key={`${cert.title}-${cert.year}-${startIndex + index}`}
                        className="certificate-card highlighted-certificate"
                        tabIndex={0}
                        role="button"
                        aria-label={`View ${cert.viewAchievement ? 'achievement' : 'certificate'} for ${cert.title}`}
                        onClick={() => handleSelectCertificate(cert)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectCertificate(cert);
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

                  {/* Numbered Pagination */}
                  {totalPages > 1 && (
                    <nav
                      className="pagination"
                      aria-label="Certificate page navigation"
                      style={{ marginTop: '35px' }}
                    >
                      <button
                        type="button"
                        className="pagination-arrow"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous Page"
                      >
                        <i className="fas fa-chevron-left" aria-hidden="true"></i>
                        <span> Prev</span>
                      </button>

                      {pageNumbers.map((page) => (
                        <button
                          key={page}
                          type="button"
                          className={currentPage === page ? 'active' : ''}
                          onClick={() => handlePageChange(page)}
                          aria-current={currentPage === page ? 'page' : undefined}
                          aria-label={`Page ${page}`}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        type="button"
                        className="pagination-arrow"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next Page"
                      >
                        <span>Next </span>
                        <i className="fas fa-chevron-right" aria-hidden="true"></i>
                      </button>
                    </nav>
                  )}
                </>
              )}
            </article>
          </section>
        </div>
      </main>

      {/* Modals */}
      <ResumeModal isOpen={isResumeOpen} onClose={() => setIsResumeOpen(false)} />

      <PdfModal
        isOpen={Boolean(pdfCert)}
        onClose={() => setPdfCert(null)}
        certificate={pdfCert}
      />

      <FullscreenImageModal
        isOpen={fullscreenModal.isOpen}
        onClose={() => setFullscreenModal((prev) => ({ ...prev, isOpen: false }))}
        certificates={fullscreenModal.certificates}
        initialIndex={fullscreenModal.initialIndex}
        showNavigation={fullscreenModal.certificates[fullscreenModal.initialIndex]?.viewAchievement === true}
      />

      <AchievementDetailModal
        isOpen={Boolean(achievementCert)}
        onClose={() => setAchievementCert(null)}
        certificate={achievementCert}
        onOpenQuickOverlay={(items, index) =>
          setQuickOverlay({ isOpen: true, items, initialIndex: index })
        }
        onOpenDemoVideo={(url, title) =>
          setDemoVideo({ isOpen: true, url, title: title || 'Demo Video' })
        }
        onOpenPdf={(cert) => setPdfCert(cert)}
      />

      <QuickImageOverlay
        isOpen={quickOverlay.isOpen}
        onClose={() => setQuickOverlay((prev) => ({ ...prev, isOpen: false }))}
        items={quickOverlay.items}
        initialIndex={quickOverlay.initialIndex}
      />

      <DemoVideoModal
        isOpen={demoVideo.isOpen}
        onClose={() => setDemoVideo((prev) => ({ ...prev, isOpen: false }))}
        videoUrl={demoVideo.url}
        title={demoVideo.title}
      />
    </>
  );
};
