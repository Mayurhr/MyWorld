import React from 'react';
import { useProfile } from '../hooks/useProfile';

interface StickyHeaderProps {
  isVisible: boolean;
  onNavigateSection: (sectionId: string) => void;
}

export const StickyHeader: React.FC<StickyHeaderProps> = ({ isVisible, onNavigateSection }) => {
  const { profile } = useProfile();

  const name = profile?.name?.trim() || 'Mayur H R';
  const photoUrl =
    profile?.profileImageUrl ||
    'https://drive.google.com/thumbnail?id=1EUeICFZ7u0iSG1M5HDmMMpz19uExqvo-&sz=w2000';

  const links = [
    { id: 'about', label: 'About' },
    { id: 'resume', label: 'Academic Background' },
    { id: 'skills', label: 'Skills' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'projects', label: 'Projects' },
    { id: 'contact', label: 'Contacts' },
  ];

  return (
    <div
      id="stickyHeader"
      className={isVisible ? 'is-visible' : ''}
      style={{ display: isVisible ? 'block' : 'none' }}
    >
      <div className="sticky-content">
        <div className="sticky-brand">
          <img
            src={photoUrl}
            alt={name}
            className="sticky-img"
            referrerPolicy="no-referrer"
          />
          <span className="sticky-name">{name}</span>
        </div>

        <nav className="sticky-nav" aria-label="Sticky navigation">
          {links.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigateSection(link.id);
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
};
