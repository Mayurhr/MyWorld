import React, { useState } from 'react';
import { useSocialLinks } from '../hooks/useSocialLinks';
import { analytics } from '../services/analytics';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  hp_website?: string; // Honeypot field for spam prevention
}

const SUBJECT_SUGGESTIONS: string[] = [
  'Project',
  'Internship',
  'Job',
  'Tech Discussion',
  'Freelance',
  'Enquiry',
  'Hello',
];

const CONVERSATION_PROMPTS: string[] = [
  'Have a project idea?',
  'Looking for someone to collaborate with?',
  'Want to discuss an opportunity?',
  'Just want to say hello?',
];

export const ContactSection: React.FC = () => {
  const { socialLinks } = useSocialLinks();
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
    hp_website: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const lastSubmittedSignatureRef = React.useRef<{ signature: string; at: number } | null>(null);
  const submitLockRef = React.useRef<boolean>(false);

  const handleSocialClick = (platform: string, url: string) => {
    analytics.trackSocialClick(platform, url);
  };

  const handleSelectSubjectSuggestion = (suggestion: string) => {
    setFormData((prev) => ({ ...prev, subject: suggestion }));
    if (submissionStatus === 'error') {
      setSubmissionStatus('idle');
      setFeedbackMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent accidental rapid duplicate submissions while request is in flight
    if (submitLockRef.current || isSubmitting) {
      return;
    }

    // Honeypot check
    if (formData.hp_website) {
      return;
    }

    // Validation
    const trimmedName = formData.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setSubmissionStatus('error');
      setFeedbackMessage('Please enter your full name (minimum 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setSubmissionStatus('error');
      setFeedbackMessage('Please provide a valid email address so I can get back to you.');
      return;
    }

    const trimmedSubject = formData.subject.trim();
    if (!trimmedSubject || trimmedSubject.length < 2) {
      setSubmissionStatus('error');
      setFeedbackMessage('Please enter a subject or select a topic above.');
      return;
    }

    const trimmedMessage = formData.message.trim();
    if (!trimmedMessage || trimmedMessage.length < 5) {
      setSubmissionStatus('error');
      setFeedbackMessage('Please write a message with at least 5 characters.');
      return;
    }

    const currentSignature = `${trimmedEmail.toLowerCase()}|${trimmedSubject.toLowerCase()}|${trimmedMessage}`;
    if (
      lastSubmittedSignatureRef.current &&
      lastSubmittedSignatureRef.current.signature === currentSignature &&
      Date.now() - lastSubmittedSignatureRef.current.at < 10000
    ) {
      setSubmissionStatus('error');
      setFeedbackMessage('Your message was just sent. Please wait a moment before sending the exact same message again.');
      return;
    }

    try {
      submitLockRef.current = true;
      setIsSubmitting(true);
      setSubmissionStatus('idle');
      setFeedbackMessage('');

      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit message. Please try again.');
      }

      lastSubmittedSignatureRef.current = { signature: currentSignature, at: Date.now() };
      setSubmissionStatus('success');
      setFeedbackMessage(
        data.message || 'Thank you for reaching out! Your message has been sent successfully.'
      );
      analytics.trackContactSubmit('success', trimmedSubject);
      setFormData({ name: '', email: '', subject: '', message: '', hp_website: '' });
    } catch (err: any) {
      setSubmissionStatus('error');
      setFeedbackMessage(err.message || 'An error occurred while sending. Please try again.');
      analytics.trackContactSubmit('error', trimmedSubject);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const renderSocialIcon = (link: { icon: string; platform: string }) => {
    const isLeetCode =
      link.platform.toLowerCase() === 'leetcode' ||
      link.icon.toLowerCase() === 'leetcode';

    if (isLeetCode) {
      return (
        <span id="leetcodeIcon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            role="img"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
          </svg>
        </span>
      );
    }

    if (link.icon.startsWith('fa-') || link.icon.startsWith('fab ') || link.icon.startsWith('fas ')) {
      return <i className={link.icon} style={{ fontSize: '18px' }}></i>;
    }

    return (
      <ion-icon
        name={link.icon}
        style={{ fontSize: '20px' }}
      ></ion-icon>
    );
  };

  return (
    <section id="contact">
      <article className="about active" data-page="about">
        {/* Section Header */}
        <header style={{ marginBottom: '20px' }}>
          <h2 className="h2 article-title">Get In Touch</h2>
        </header>

        {/* Two-Column Grid: Form on Left, Conversation Prompts on Right */}
        <div className="contact-two-column-layout">
          {/* LEFT SIDE: Message Form Panel */}
          <div
            className="contact-form-panel"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
              margin: 0,
            }}
          >
            <h3
              style={{
                color: 'var(--white-2)',
                fontSize: '1.25rem',
                fontWeight: 600,
                margin: '0 0 20px 0',
              }}
            >
              Send a Message
            </h3>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Honeypot field (hidden from normal visitors) */}
            <div style={{ display: 'none' }} aria-hidden="true">
              <input
                type="text"
                name="hp_website"
                value={formData.hp_website}
                onChange={(e) => setFormData({ ...formData, hp_website: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Row 1: Name and Email */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <label
                  htmlFor="contact-name"
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    color: 'var(--light-gray)',
                    marginBottom: '8px',
                    fontWeight: 500,
                  }}
                >
                  Your Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    color: 'var(--light-gray)',
                    marginBottom: '8px',
                    fontWeight: 500,
                  }}
                >
                  Your Email <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. john@example.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Subject with Ready-Made Suggestions */}
            <div>
              <label
                htmlFor="contact-subject"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--light-gray)',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}
              >
                Subject <span style={{ color: '#f87171' }}>*</span>
              </label>

              <div
                className="subject-suggestions-group"
                role="group"
                aria-label="Subject topic suggestions"
              >
                {SUBJECT_SUGGESTIONS.map((topic) => {
                  const isSelected =
                    formData.subject.trim().toLowerCase() === topic.toLowerCase();
                  return (
                    <button
                      key={topic}
                      type="button"
                      className={`subject-suggestion-btn ${isSelected ? 'active' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectSubjectSuggestion(topic)}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>

              <input
                id="contact-subject"
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Choose a topic above or type your own subject..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="contact-message"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--light-gray)',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}
              >
                Message <span style={{ color: '#f87171' }}>*</span>
              </label>
              <textarea
                id="contact-message"
                rows={5}
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Write your message here..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: isSubmitting
                  ? '#4b5563'
                  : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.25s ease',
                marginTop: '4px',
              }}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                  <span>Sending Message...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane" aria-hidden="true"></i>
                  <span>Send Message</span>
                </>
              )}
            </button>
          </form>

          {/* Feedback Banner */}
          {submissionStatus !== 'idle' && (
            <div
              role={submissionStatus === 'error' ? 'alert' : 'status'}
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor:
                  submissionStatus === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${submissionStatus === 'success' ? '#10b981' : '#ef4444'}`,
                color: submissionStatus === 'success' ? '#34d399' : '#fca5a5',
              }}
            >
              <i
                className={
                  submissionStatus === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle'
                }
                style={{ fontSize: '18px', flexShrink: 0 }}
                aria-hidden="true"
              ></i>
              <span>{feedbackMessage}</span>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Have Something in Mind? conversation prompts & Connect With Me */}
        <div
          className="contact-prompts-card"
          role="region"
          aria-label="Conversation prompts and social links"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          {/* Upper Section: Conversation Prompts */}
          <div>
            <div className="contact-prompts-header">
              <span className="contact-prompts-dot" aria-hidden="true"></span>
              <h3 className="contact-prompts-heading">Have something in mind?</h3>
            </div>
            <ul className="contact-prompts-list">
              {CONVERSATION_PROMPTS.map((prompt, idx) => (
                <li
                  key={prompt}
                  className="contact-prompt-item"
                  style={{ '--prompt-i': idx } as React.CSSProperties}
                >
                  <i className="fas fa-comment-dots" aria-hidden="true"></i>
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Lower Section: Connect With Me Social Links */}
          <div
            className="contact-prompts-connect"
            style={{
              marginTop: '28px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px',
              }}
            >
              <i
                className="fas fa-share-nodes"
                style={{ color: 'var(--orange-yellow-crayola)', fontSize: '0.9rem' }}
                aria-hidden="true"
              ></i>
              <h4
                style={{
                  color: 'var(--white-2)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  margin: 0,
                }}
              >
                Connect With Me
              </h4>
            </div>

            <div
              className="social-icons"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              {socialLinks
                .filter((link) => link.isActive !== false)
                .map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-icon"
                    title={link.title || link.platform}
                    aria-label={link.title || link.platform}
                    onClick={() => handleSocialClick(link.platform, link.url)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      transition: 'all 0.3s ease',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.08)';
                      e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {renderSocialIcon(link)}
                  </a>
                ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  </section>
);
};
