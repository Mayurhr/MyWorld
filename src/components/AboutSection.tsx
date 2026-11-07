import React from 'react';
import { useProfile } from '../hooks/useProfile';

export const AboutSection: React.FC = () => {
  const { profile } = useProfile();

  const paragraphs =
    profile?.aboutParagraphs && profile.aboutParagraphs.length > 0
      ? profile.aboutParagraphs
      : [
          "I'm a Web Developer from Honnali, Davanagere, passionate about creating functional and user-friendly websites. I enjoy turning ideas into reality through clean code and intuitive designs.",
          "My focus is on building responsive websites that deliver great user experiences. I pay attention to details and ensure my work meets both technical requirements and design standards.",
        ];

  return (
    <section id="about">
      <article className="about active" data-page="about">
        <section id="about" className="about-text">
          <br />
          <header>
            <h2 className="h2 article-title">About me</h2>
          </header>
          {paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </section>
      </article>
    </section>
  );
};
