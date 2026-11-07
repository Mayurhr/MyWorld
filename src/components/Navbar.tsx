import React from 'react';

interface NavbarProps {
  activeSection?: string;
  onNavigateSection: (sectionId: string) => void;
  isHidden?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateSection, isHidden }) => {
  const links = [
    { id: 'about', label: 'About' },
    { id: 'resume', label: 'Academic Background' },
    { id: 'skills', label: 'Skills' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'projects', label: 'Projects' },
    { id: 'contact', label: 'Contacts' },
  ];

  return (
    <nav className={`navbar ${isHidden ? 'hidden' : ''}`} aria-label="Main navigation">
      <ul className="navbar-list">
        {links.map((link) => (
          <li key={link.id} className="navbar-item">
            <a
              href={`#${link.id}`}
              className="navbar-link"
              onClick={(e) => {
                e.preventDefault();
                onNavigateSection(link.id);
              }}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
