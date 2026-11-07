import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Certificate } from '../types';
import { useCertificates } from '../hooks/useCertificates';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { StickyHeader } from '../components/StickyHeader';
import { About } from '../components/About';
import { Education } from '../components/Education';
import { Skills } from '../components/Skills';
import { Certificates } from '../components/Certificates';
import { Projects } from '../components/Projects';
import { Contact } from '../components/Contact';
import { ResumeModal } from '../components/ResumeModal';
import { FullscreenImageModal } from '../components/FullscreenImageModal';
import { AchievementDetailModal } from '../components/AchievementDetailModal';
import { QuickImageOverlay } from '../components/QuickImageOverlay';
import { DemoVideoModal } from '../components/DemoVideoModal';
import { ProjectVideoModal } from '../components/ProjectVideoModal';
import { PdfModal } from '../components/PdfModal';
import { isPdfCertificate } from '../utils/drive';
import { MayuAiAssistant } from '../components/MayuAiAssistant';
import { initEngagementTracker, analytics } from '../services/analytics';
import { useSectionAnalytics } from '../hooks/useSectionAnalytics';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { certificates } = useCertificates();
  const [stickyVisible, setStickyVisible] = useState(false);

  // Initialize real analytics engagement tracking & section observer
  useEffect(() => {
    const cleanup = initEngagementTracker();
    return cleanup;
  }, []);

  useSectionAnalytics(['about', 'education', 'skills', 'certificates', 'projects', 'contact']);

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

  const [projectVideo, setProjectVideo] = useState<{
    isOpen: boolean;
    videoSrc: string;
    title: string;
  }>({
    isOpen: false,
    videoSrc: '',
    title: '',
  });

  // Sticky header scroll behavior on desktop and tablet
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth >= 768) {
        setStickyVisible(window.scrollY > 200);
      } else {
        setStickyVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      const offsetTop = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 96);
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  };

  const handleSelectCertificate = (cert: Certificate) => {
    analytics.trackCertificateInteraction(
      cert.title,
      cert.viewAchievement ? 'view_modal' : 'view_image'
    );

    if (cert.viewAchievement === true) {
      setAchievementCert(cert);
    } else if (isPdfCertificate(cert.driveLink)) {
      setPdfCert(cert);
    } else {
      const index = certificates.findIndex(
        (c) => c.title === cert.title && c.driveLink === cert.driveLink
      );
      setFullscreenModal({
        isOpen: true,
        certificates: certificates,
        initialIndex: index >= 0 ? index : 0,
      });
    }
  };

  return (
    <>
      <main>
        {/* Sidebar */}
        <Sidebar
          currentView="home"
          onNavigateHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          onOpenResume={() => setIsResumeOpen(true)}
        />

        {/* Main Content Area */}
        <div className="main-content">
          <Navbar onNavigateSection={scrollToSection} isHidden={stickyVisible} />

          <StickyHeader isVisible={stickyVisible} onNavigateSection={scrollToSection} />

          <About />
          <Education />
          <Skills />
          <Certificates
            certificates={certificates}
            onSelectCertificate={handleSelectCertificate}
            onViewAll={() => {
              navigate('/certificates');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
          <Projects
            onOpenVideo={(videoSrc, title) =>
              setProjectVideo({ isOpen: true, videoSrc, title })
            }
          />
          <Contact />
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

      <ProjectVideoModal
        isOpen={projectVideo.isOpen}
        onClose={() => setProjectVideo((prev) => ({ ...prev, isOpen: false }))}
        videoSrc={projectVideo.videoSrc}
        title={projectVideo.title}
      />

      {/* Floating MAYU AI Portfolio Assistant */}
      <MayuAiAssistant
        onNavigateSection={scrollToSection}
        onOpenResume={() => setIsResumeOpen(true)}
      />
    </>
  );
};
