import React from 'react';
import { useProfile } from '../hooks/useProfile';

interface SidebarProps {
  currentView?: string;
  onNavigateHome?: () => void;
  onOpenResume: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenResume }) => {
  const { profile } = useProfile();

  const name = profile?.name?.trim() || 'Mayur H R';
  const rawTagline = profile?.tagline?.trim() || 'Passionate about Learning & Growth';
  const tagline = rawTagline.replace(/^["“]+|["”]+$/g, '').trim() || 'Passionate about Learning & Growth';
  const photoUrl =
    profile?.profileImageUrl ||
    'https://drive.google.com/thumbnail?id=1EUeICFZ7u0iSG1M5HDmMMpz19uExqvo-&sz=w2000';

  return (
    <aside className="sidebar profile-header-aside" data-sidebar>
      <div className="sidebar-info profile-header-info">
        <div className="profile-banner profile-header-card">
          <div className="banner-image profile-header-avatar">
            <img
              src={photoUrl}
              alt={name}
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="banner-content profile-header-content">
            <h1 className="name profile-header-name">{name}</h1>
            <p className="tagline profile-header-tagline">{tagline}</p>
          </div>

          <div className="resume-container profile-header-resume">
            <button
              type="button"
              className="resume-link"
              onClick={onOpenResume}
              aria-label="View Resume"
            >
              <i className="fas fa-file-alt" aria-hidden="true"></i>
              <span>Resume</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
