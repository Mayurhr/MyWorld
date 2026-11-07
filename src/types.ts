import React from 'react';

export interface Achievement {
  experience?: string;
  eventPhotos?: string[];
  github?: string;
  presentation?: string;
  offerLetter?: string;
  demoVideo?: string;
}

export interface Certificate {
  title: string;
  issuer: string;
  year: string;
  category: string;
  featured?: boolean;
  viewAchievement?: boolean;
  driveLink: string;
  achievement?: Achievement;
  github?: string;
  presentation?: string;
  offerLetter?: string;
  demoVideo?: string;
}

export interface Project {
  title: string;
  description: string;
  cardDescription?: string;
  image: string;
  category: string;
  tech: string[];
  cardTech?: string[];
  features?: string[];
  github?: string;
  demo?: string;
  videoDemo?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ion-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        name?: string;
      };
    }
  }
}
