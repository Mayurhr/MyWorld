import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface MayuAiAssistantProps {
  onNavigateSection?: (sectionId: string) => void;
  onOpenResume?: () => void;
}

type MascotMood = 'welcoming' | 'happy' | 'thinking' | 'curious';

// Data types for rich components
interface ProjectCardData {
  title: string;
  category?: string;
  description: string;
  tech?: string[];
  features?: string[];
  github?: string;
  demo?: string;
  sectionId?: string;
}

interface SkillCardData {
  name: string;
  category?: string;
  icon?: string;
  description?: string;
}

interface AchievementCardData {
  title: string;
  organization: string;
  year?: string;
  description: string;
  sectionId?: string;
}

interface EducationCardData {
  degree: string;
  institution: string;
  duration?: string;
  specialization?: string;
  grade?: string;
  sectionId?: string;
}

interface ActionItemData {
  label: string;
  action: string;
  icon?: string;
}

/**
 * 3D-styled expressive companion character: MAYU AI
 * Featuring subtle floating, blinking, thinking, and happy expressions.
 */
export const MayuCompanionMascot: React.FC<{
  size?: number;
  mood?: MascotMood;
  isThinking?: boolean;
}> = ({ size = 48, mood = 'welcoming', isThinking = false }) => {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (isThinking) return;
    const triggerBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 220);
    };

    const interval = setInterval(triggerBlink, 3800);
    return () => clearInterval(interval);
  }, [isThinking]);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{
          filter: 'drop-shadow(0 6px 14px rgba(99, 102, 241, 0.45))',
          animation: isThinking
            ? 'mayuThinkingBob 1.2s ease-in-out infinite'
            : 'mayuCompanionFloat 3.4s ease-in-out infinite',
        }}
      >
        <defs>
          {/* Outer Shell Gradient (Curved 3D metallic purple/indigo finish) */}
          <linearGradient id="body3dGrad" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="25%" stopColor="#818cf8" />
            <stop offset="70%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>

          {/* Visor Screen Gradient (Dark glass with subtle neon sheen) */}
          <linearGradient id="visorGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0b0f19" />
            <stop offset="60%" stopColor="#111827" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>

          {/* Holographic Eye & Core Cyan Gradient */}
          <linearGradient id="cyanGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Ear Pod Gradient */}
          <linearGradient id="earPodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>

          {/* 3D Specular Highlight */}
          <radialGradient id="specularHighlight" cx="35%" cy="25%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Floating Halo Antenna with glowing pulse beacon */}
        <line x1="50" y1="17" x2="50" y2="7" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="7" r="4.5" fill="#38bdf8">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Left & Right Audio Sensor Pods */}
        <rect x="11" y="40" width="7" height="20" rx="3.5" fill="url(#earPodGrad)" />
        <rect x="82" y="40" width="7" height="20" rx="3.5" fill="url(#earPodGrad)" />

        {/* Main 3D Head Shell */}
        <rect
          x="18"
          y="18"
          width="64"
          height="64"
          rx="24"
          fill="url(#body3dGrad)"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1.2"
        />

        {/* 3D Specular Sheen Layer */}
        <rect x="18" y="18" width="64" height="64" rx="24" fill="url(#specularHighlight)" />

        {/* Visor Screen (Recessed curved display) */}
        <rect
          x="26"
          y="28"
          width="48"
          height="44"
          rx="16"
          fill="url(#visorGlassGrad)"
          stroke="rgba(99, 102, 241, 0.5)"
          strokeWidth="1.2"
        />

        {/* Visor Glass Reflection Curve */}
        <path
          d="M 28 36 Q 50 30 72 36"
          fill="none"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Digital Expressive Face Layer */}
        {isThinking ? (
          <g>
            <circle cx="39" cy="48" r="4.5" fill="url(#cyanGlowGrad)">
              <animate attributeName="r" values="3.5;5.5;3.5" dur="0.9s" repeatCount="indefinite" />
            </circle>
            <circle cx="61" cy="48" r="4.5" fill="url(#cyanGlowGrad)">
              <animate attributeName="r" values="5.5;3.5;5.5" dur="0.9s" repeatCount="indefinite" />
            </circle>
            <path
              d="M 36 60 Q 50 54 64 60"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <animate
                attributeName="d"
                values="M 36 60 Q 50 54 64 60; M 36 57 Q 50 63 64 57; M 36 60 Q 50 54 64 60"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        ) : blink ? (
          <g>
            <line x1="34" y1="48" x2="44" y2="48" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <line x1="56" y1="48" x2="66" y2="48" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <path d="M 44 58 Q 50 62 56 58" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : mood === 'happy' ? (
          <g>
            <path
              d="M 34 49 Q 39 42 44 49"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <path
              d="M 56 49 Q 61 42 66 49"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <path
              d="M 43 58 Q 50 64 57 58"
              fill="none"
              stroke="#a5b4fc"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>
        ) : mood === 'curious' ? (
          <g>
            <circle cx="39" cy="48" r="4.8" fill="url(#cyanGlowGrad)" />
            <circle cx="61" cy="45" r="5.2" fill="url(#cyanGlowGrad)" />
            <path d="M 56 39 Q 61 36 66 39" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="46" y1="59" x2="54" y2="59" stroke="#a5b4fc" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="39" cy="47" r="4.5" fill="url(#cyanGlowGrad)" />
            <circle cx="61" cy="47" r="4.5" fill="url(#cyanGlowGrad)" />
            <circle cx="38" cy="46" r="1.5" fill="#ffffff" />
            <circle cx="60" cy="46" r="1.5" fill="#ffffff" />
            <path
              d="M 44 58 Q 50 62 56 58"
              fill="none"
              stroke="#a5b4fc"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        )}

        <circle cx="31" cy="55" r="2.5" fill="#f472b6" opacity="0.65" />
        <circle cx="69" cy="55" r="2.5" fill="#f472b6" opacity="0.65" />
      </svg>
    </div>
  );
};

interface QuestionSuggestion {
  label: string;
  question: string;
}

const READY_MADE_SUGGESTIONS: QuestionSuggestion[] = [
  { label: 'About Mayur', question: 'Tell me about Mayur' },
  { label: 'Projects', question: 'What projects has he built?' },
  { label: 'Skills', question: 'What technologies does he know?' },
  { label: 'Education', question: 'Tell me about his academic journey' },
  { label: 'Achievements', question: 'What are his achievements?' },
  { label: 'Resume', question: 'Can I view his resume?' },
  { label: 'Contact', question: 'How can I contact him?' },
];

/**
 * Returns dynamic, context-aware question suggestions based on ongoing chat history
 */
const getContextualSuggestions = (history: ChatMessage[]): QuestionSuggestion[] => {
  const userMessages = history.filter((m) => m.role === 'user');
  if (userMessages.length === 0) {
    return READY_MADE_SUGGESTIONS;
  }

  const lastUserText = (userMessages[userMessages.length - 1]?.text || '').toLowerCase();
  const lastModelMsg = [...history].reverse().find((m) => m.role === 'model')?.text.toLowerCase() || '';
  const context = `${lastUserText} ${lastModelMsg}`;

  // If asking about Skills or Tech
  if (/skill|tech|stack|language|framework|python|react|frontend|backend|cloud|devops|database|sql/.test(context)) {
    return [
      { label: 'Frontend skills', question: 'What are Mayur’s frontend engineering skills?' },
      { label: 'Backend skills', question: 'What backend technologies does Mayur specialize in?' },
      { label: 'AI technologies', question: 'What AI and Gemini technologies has Mayur built with?' },
      { label: 'Programming languages', question: 'What programming languages does Mayur code in?' },
      { label: 'Tools used', question: 'What developer tools and cloud platforms does he use?' },
      { label: 'Top projects', question: 'Which projects showcase these technical skills?' },
    ];
  }

  // If asking about Projects
  if (/project|app|build|system|portal|portfolio|code|github|repo|demo|flagship/.test(context)) {
    return [
      { label: 'Best project', question: 'What is Mayur’s best and most impressive project?' },
      { label: 'Project technologies', question: 'What technologies are used in his projects?' },
      { label: 'How projects work', question: 'How do Mayur’s projects work in detail?' },
      { label: 'GitHub repositories', question: 'Where can I find his GitHub repositories?' },
      { label: 'Live demos', question: 'Which projects have active live demos?' },
      { label: 'Contact Mayur', question: 'How can I collaborate on a project with Mayur?' },
    ];
  }

  // If asking about Education / Academics
  if (/education|academic|college|university|degree|school|cgpa|course|study/.test(context)) {
    return [
      { label: 'College details', question: 'Tell me about Mayur’s college and university' },
      { label: 'Academic performance', question: 'What is his academic performance and CGPA?' },
      { label: 'Certifications', question: 'What certifications has Mayur achieved?' },
      { label: 'Core subjects', question: 'What key computer science subjects has he studied?' },
      { label: 'View resume', question: 'Can I see his full academic resume?' },
    ];
  }

  // If asking about Achievements or Certifications
  if (/achievement|certificate|credential|hackathon|award|honor|rank|contest/.test(context)) {
    return [
      { label: 'Certifications', question: 'What certifications does Mayur hold?' },
      { label: 'Hackathons', question: 'Tell me about Mayur’s hackathons and competitions' },
      { label: 'Awards & Honors', question: 'What major awards has Mayur received?' },
      { label: 'Key projects', question: 'What projects earned awards or recognition?' },
      { label: 'Contact him', question: 'How can I reach out to Mayur?' },
    ];
  }

  // If asking about Contact or Reaching Out
  if (/contact|email|message|reach|hire|collaborate|touch|talk|recruiter/.test(context)) {
    return [
      { label: 'Send message', question: 'How do I send a message using the contact form?' },
      { label: 'Social profiles', question: 'What are his LinkedIn and GitHub links?' },
      { label: 'Email address', question: 'What is Mayur’s direct email address?' },
      { label: 'Recruiter summary', question: 'Give me a concise summary for technical recruiters' },
      { label: 'View resume', question: 'How can I review Mayur’s resume?' },
    ];
  }

  // If asking about Resume
  if (/resume|cv|experience|profile|summary/.test(context)) {
    return [
      { label: 'View resume', question: 'Can I open Mayur’s full resume modal?' },
      { label: 'Core qualifications', question: 'What are Mayur’s core technical qualifications?' },
      { label: 'Featured projects', question: 'What projects are highlighted on his resume?' },
      { label: 'Technical skills', question: 'What skills are highlighted on his resume?' },
      { label: 'Contact Mayur', question: 'How can I contact Mayur for an interview?' },
    ];
  }

  // Diverse default suggestions for general queries
  return [
    { label: 'About Mayur', question: 'Tell me about Mayur’s background' },
    { label: 'Best project', question: 'What is Mayur’s best project?' },
    { label: 'Core skills', question: 'What are his primary programming skills?' },
    { label: 'Education', question: 'Where did Mayur study?' },
    { label: 'View resume', question: 'Can I view his resume?' },
    { label: 'Get in touch', question: 'How can I get in touch with Mayur?' },
  ];
};

export const MayuAiAssistant: React.FC<MayuAiAssistantProps> = ({
  onNavigateSection,
  onOpenResume,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRecruiterMode, setIsRecruiterMode] = useState<boolean>(false);
  const [showGreetingBubble, setShowGreetingBubble] = useState<boolean>(false);
  const [mascotMood, setMascotMood] = useState<MascotMood>('welcoming');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const hasUserStartedChat = messages.some((m) => m.role === 'user');

  // Welcome bubble on first visit
  useEffect(() => {
    const welcomed = sessionStorage.getItem('mayu_ai_welcomed');
    if (!welcomed) {
      const timer = setTimeout(() => {
        setShowGreetingBubble(true);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Initialize welcome message in chat history
  useEffect(() => {
    if (messages.length === 0) {
      const welcome: ChatMessage = {
        id: 'welcome_init',
        role: 'model',
        text: `### Hi there! I'm MAYU AI

I am your personal AI guide to **Mayur H R's portfolio**. Ask me anything about his **projects**, **technical skills**, **academic background**, or **resume**!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcome]);
    }
  }, []);

  // Auto scroll
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, isMinimized]);

  // Focus input
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, isMinimized]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setShowGreetingBubble(false);
    sessionStorage.setItem('mayu_ai_welcomed', 'true');
    setMascotMood('happy');
    setTimeout(() => setMascotMood('welcoming'), 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleToggleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  const handleResetConversation = () => {
    const welcome: ChatMessage = {
      id: `welcome_${Date.now()}`,
      role: 'model',
      text: isRecruiterMode
        ? `### 💼 Recruiter Mode Active\n\nAsk me for an executive summary of Mayur's technical competencies, education, flagship projects, or contact vectors.`
        : `Conversation reset! ✨ What would you like to explore about Mayur's work, tech stack, or achievements?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcome]);
  };

  const handleToggleRecruiterMode = () => {
    const newMode = !isRecruiterMode;
    setIsRecruiterMode(newMode);
    const modeNotice: ChatMessage = {
      id: `mode_${Date.now()}`,
      role: 'model',
      text: newMode
        ? `💼 **Recruiter Mode Enabled**: I will now provide comprehensive, high-impact candidate overviews tailored for technical recruiters and hiring managers.`
        : `✨ **Explorer Mode Enabled**: Let's discover Mayur's projects, stories, skills, and background together!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, modeNotice]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setMascotMood('thinking');

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/mayu-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          mode: isRecruiterMode ? 'recruiter' : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'MAYU AI could not process your request.');
      }

      const modelMsg: ChatMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, modelMsg]);
      setMascotMood('happy');
      setTimeout(() => setMascotMood('welcoming'), 2500);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'model',
        text: `I'm having a little difficulty reaching my knowledge engine right now. Please feel free to explore the sections manually or contact Mayur directly at **mayurhr57@gmail.com**!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setMascotMood('curious');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkClick = (hash: string) => {
    if (hash === '#open-resume' || hash === '#view-resume' || hash === '#resume-modal') {
      setIsMinimized(true);
      if (onOpenResume) {
        onOpenResume();
      }
      return;
    }

    let cleanId = hash.replace(/^#/, '');
    if (cleanId === 'education' || cleanId === 'academic-background') {
      cleanId = 'resume';
    }

    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsMinimized(true);
    }

    if (cleanId.startsWith('project-')) {
      const specificEl = document.getElementById(cleanId);
      if (specificEl) {
        const offsetTop = Math.max(0, specificEl.getBoundingClientRect().top + window.pageYOffset - 96);
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        specificEl.focus({ preventScroll: true });
        return;
      }
      cleanId = 'projects';
    }

    if (onNavigateSection) {
      onNavigateSection(cleanId);
    } else {
      const el = document.getElementById(cleanId);
      if (el) {
        const offsetTop = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 96);
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    }
  };

  const handleCopyText = (rawText: string, messageId: string) => {
    // Strip tag wrappers for clean text clipboard copy
    const cleanText = rawText
      .replace(/:::(project|skill|achievement|education|actions|table)[\s\S]*?:::/g, '')
      .replace(/\[([^\]]+)\]\((#[^)]+|https?:\/\/[^)]+)\)/g, '$1')
      .trim();

    navigator.clipboard.writeText(cleanText || rawText);
    setCopiedMessageId(messageId);
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  };

  const handleCopyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeKey(key);
    setTimeout(() => {
      setCopiedCodeKey(null);
    }, 2000);
  };

  /**
   * Helper to parse and render standard Markdown tables
   */
  const renderMarkdownTable = (tableLines: string[], key: string) => {
    if (tableLines.length < 2) return null;

    // Filter out separator rows like | :--- | :--- |
    const headerRow = tableLines[0];
    const dataRows = tableLines.slice(1).filter((row) => !/^\|[\s\-:]+(\|[\s\-:]+)*\|?$/.test(row.trim()));

    const parseCells = (row: string) =>
      row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

    const headers = parseCells(headerRow);

    return (
      <div key={key} className="mayu-table-wrap">
        <table className="mayu-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{renderInlineFormatting(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((r, rIdx) => {
              const cells = parseCells(r);
              return (
                <tr key={rIdx}>
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInlineFormatting(cell)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /**
   * Parses inline Markdown (bolds, code pills, external links, action buttons)
   */
  const renderInlineFormatting = (content: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    // Match [label](target)
    const linkRegex = /\[([^\]]+)\]\((#[a-zA-Z0-9_-]+|https?:\/\/[^\)]+)\)/g;

    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderBoldsAndCode(content.substring(lastIndex, match.index)));
      }

      const label = match[1];
      const url = match[2];

      if (url.startsWith('#')) {
        parts.push(
          <button
            key={`link_${match.index}`}
            type="button"
            onClick={() => handleLinkClick(url)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              margin: '0 2px',
              borderRadius: '6px',
              backgroundColor: 'rgba(99, 102, 241, 0.22)',
              border: '1px solid rgba(99, 102, 241, 0.45)',
              color: '#93c5fd',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{label}</span>
            <i className="fas fa-arrow-right" style={{ fontSize: '10px' }}></i>
          </button>
        );
      } else {
        parts.push(
          <a
            key={`ext_${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#93c5fd', textDecoration: 'underline', fontWeight: 500 }}
          >
            {label}
          </a>
        );
      }

      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(renderBoldsAndCode(content.substring(lastIndex)));
    }

    return parts;
  };

  const renderBoldsAndCode = (str: string): React.ReactNode => {
    // Tokenize bolds **text** and code `code`
    const tokens = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return (
          <strong key={i} style={{ color: '#ffffff', fontWeight: 600 }}>
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return (
          <code
            key={i}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: '4px',
              color: '#facc15',
              fontSize: '0.82em',
              fontFamily: 'monospace',
            }}
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      return tok;
    });
  };

  /**
   * Separates fenced code blocks (```lang ... ```) from normal markdown text
   */
  const renderCodeBlocksAndText = (rawChunk: string, parentKey: string): React.ReactNode[] => {
    const codeBlockRegex = /```([a-zA-Z0-9_\-+]*)\n([\s\S]*?)```/g;
    const elements: React.ReactNode[] = [];

    let lastIdx = 0;
    let match;

    while ((match = codeBlockRegex.exec(rawChunk)) !== null) {
      if (match.index > lastIdx) {
        const textBefore = rawChunk.substring(lastIdx, match.index);
        elements.push(renderTextAndTables(textBefore, `${parentKey}_pre_${lastIdx}`));
      }

      const lang = match[1]?.trim() || 'code';
      const code = match[2]?.replace(/\n$/, '') || '';
      const codeKey = `${parentKey}_code_${match.index}`;
      const isCodeCopied = copiedCodeKey === codeKey;

      elements.push(
        <div key={codeKey} className="mayu-code-card">
          <div className="mayu-code-header">
            <span className="mayu-code-lang">
              <i className="fas fa-terminal" style={{ fontSize: '10px' }}></i>
              <span>{lang}</span>
            </span>
            <button
              type="button"
              className="mayu-code-copy-btn"
              onClick={() => handleCopyCode(code, codeKey)}
              title="Copy snippet"
              aria-label="Copy code snippet"
            >
              <i className={isCodeCopied ? 'fas fa-check' : 'fas fa-copy'} style={{ fontSize: '10px' }}></i>
              <span>{isCodeCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <pre className="mayu-code-pre">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIdx = codeBlockRegex.lastIndex;
    }

    if (lastIdx < rawChunk.length) {
      elements.push(renderTextAndTables(rawChunk.substring(lastIdx), `${parentKey}_post_${lastIdx}`));
    }

    return elements;
  };

  /**
   * Main Rich Response Parser
   * Splits into text segments, custom rich cards, and markdown tables
   */
  const renderMessageContent = (rawText: string) => {
    // Regex for custom cards: :::(project|skill|achievement|education|actions|table) [JSON] :::
    const blockRegex = /:::(project|skill|achievement|education|actions|table)\s*([\s\S]*?):::/g;
    const elements: React.ReactNode[] = [];

    let lastIdx = 0;
    let match;

    while ((match = blockRegex.exec(rawText)) !== null) {
      // 1. Text segment prior to tag (supporting code blocks)
      if (match.index > lastIdx) {
        const textChunk = rawText.substring(lastIdx, match.index);
        elements.push(...renderCodeBlocksAndText(textChunk, `chunk_${lastIdx}`));
      }

      // 2. Custom Rich Card
      const cardType = match[1];
      const jsonContent = match[2].trim();

      try {
        const parsed = JSON.parse(jsonContent);

        if (cardType === 'project') {
          const p = parsed as ProjectCardData;
          const computedSlug = p.title
            ? `project-${p.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')}`
            : 'projects';
          const targetSectionId = p.sectionId ? p.sectionId.replace(/^#/, '') : computedSlug;

          elements.push(
            <div key={`proj_${match.index}`} className="mayu-project-card">
              <div className="mayu-project-header">
                <h4 className="mayu-project-title">{p.title}</h4>
                {p.category && <span className="mayu-project-category">{p.category}</span>}
              </div>
              <p className="mayu-project-desc">{p.description}</p>

              {p.tech && p.tech.length > 0 && (
                <div className="mayu-project-tech-list">
                  {p.tech.map((t, ti) => (
                    <span key={ti} className="mayu-tech-pill">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {p.features && p.features.length > 0 && (
                <ul className="mayu-project-features">
                  {p.features.map((feat, fi) => (
                    <li key={fi}>
                      <i className="fas fa-check-circle"></i>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mayu-project-actions">
                <button
                  type="button"
                  className="mayu-btn-primary"
                  onClick={() => handleLinkClick(`#${targetSectionId}`)}
                >
                  <i className="fas fa-laptop-code"></i>
                  <span>View Project</span>
                </button>

                {p.github && (
                  <a
                    href={p.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mayu-btn-secondary"
                  >
                    <i className="fab fa-github"></i>
                    <span>GitHub Code</span>
                  </a>
                )}

                {p.demo && (
                  <a
                    href={p.demo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mayu-btn-secondary"
                  >
                    <i className="fas fa-external-link-alt"></i>
                    <span>Live Demo</span>
                  </a>
                )}
              </div>
            </div>
          );
        } else if (cardType === 'skill') {
          const s = parsed as SkillCardData;
          elements.push(
            <div key={`skill_${match.index}`} className="mayu-skill-card">
              <div className="mayu-skill-icon-wrap">
                <i className={s.icon || 'fas fa-code'}></i>
              </div>
              <div className="mayu-skill-info">
                <div className="mayu-skill-name-row">
                  <span className="mayu-skill-name">{s.name}</span>
                  {s.category && <span className="mayu-skill-cat">{s.category}</span>}
                </div>
                {s.description && <p className="mayu-skill-desc">{s.description}</p>}
              </div>
            </div>
          );
        } else if (cardType === 'achievement') {
          const a = parsed as AchievementCardData;
          elements.push(
            <div key={`ach_${match.index}`} className="mayu-achievement-card">
              <div className="mayu-achievement-icon">
                <i className="fas fa-trophy"></i>
              </div>
              <div style={{ flex: 1 }}>
                <h5 className="mayu-achievement-title">{a.title}</h5>
                <div className="mayu-achievement-meta">
                  {a.organization} {a.year ? `• ${a.year}` : ''}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {a.description}
                </p>
                <button
                  type="button"
                  onClick={() => handleLinkClick('#certificates')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--orange-yellow-crayola)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    padding: '4px 0 0 0',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Inspect Credentials</span>
                  <i className="fas fa-arrow-right" style={{ fontSize: '9px' }}></i>
                </button>
              </div>
            </div>
          );
        } else if (cardType === 'education') {
          const ed = parsed as EducationCardData;
          elements.push(
            <div key={`edu_${match.index}`} className="mayu-education-card">
              <div className="mayu-education-icon">
                <i className="fas fa-graduation-cap"></i>
              </div>
              <div style={{ flex: 1 }}>
                <h5 className="mayu-education-degree">{ed.degree}</h5>
                <div className="mayu-education-meta">
                  {ed.institution} {ed.duration ? `• ${ed.duration}` : ''}
                </div>
                {ed.specialization && (
                  <div className="mayu-education-details">
                    <strong style={{ color: '#e2e8f0' }}>Specialization:</strong> {ed.specialization}
                  </div>
                )}
                {ed.grade && (
                  <div className="mayu-education-details">
                    <strong style={{ color: '#e2e8f0' }}>Grade:</strong> {ed.grade}
                  </div>
                )}
              </div>
            </div>
          );
        } else if (cardType === 'actions') {
          const actList = parsed as ActionItemData[];
          elements.push(
            <div key={`actions_${match.index}`} className="mayu-actions-row">
              {actList.map((action, ai) => (
                <button
                  key={ai}
                  type="button"
                  className="mayu-action-btn"
                  onClick={() => handleLinkClick(action.action)}
                >
                  {action.icon && <i className={action.icon} style={{ fontSize: '11px' }}></i>}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          );
        }
      } catch (err) {
        // Fallback to text with code block parsing
        elements.push(...renderCodeBlocksAndText(match[0], `err_${match.index}`));
      }

      lastIdx = blockRegex.lastIndex;
    }

    if (lastIdx < rawText.length) {
      elements.push(...renderCodeBlocksAndText(rawText.substring(lastIdx), `chunk_${lastIdx}`));
    }

    return elements;
  };

  /**
   * Parses regular markdown text and checks for embedded tables, headings, callouts, lists
   */
  const renderTextAndTables = (chunk: string, parentKey: string) => {
    const lines = chunk.split('\n');
    const result: React.ReactNode[] = [];

    let tableBuffer: string[] = [];

    const flushTable = (idx: number) => {
      if (tableBuffer.length > 0) {
        result.push(renderMarkdownTable(tableBuffer, `${parentKey}_tbl_${idx}`));
        tableBuffer = [];
      }
    };

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Check for table line: | cell | cell |
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
        tableBuffer.push(trimmed);
        return;
      }

      // If not a table line, flush any accumulated table
      flushTable(lineIdx);

      // Check headings (H1 to H4)
      if (trimmed.startsWith('#### ')) {
        result.push(
          <h5 key={`${parentKey}_${lineIdx}`} className="mayu-rich-h4">
            {renderInlineFormatting(trimmed.replace(/^####\s+/, ''))}
          </h5>
        );
        return;
      }

      if (trimmed.startsWith('### ')) {
        result.push(
          <h4 key={`${parentKey}_${lineIdx}`} className="mayu-rich-h3">
            {renderInlineFormatting(trimmed.replace(/^###\s+/, ''))}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        result.push(
          <h3 key={`${parentKey}_${lineIdx}`} className="mayu-rich-h2">
            {renderInlineFormatting(trimmed.replace(/^##\s+/, ''))}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith('# ')) {
        result.push(
          <h2 key={`${parentKey}_${lineIdx}`} className="mayu-rich-h1">
            {renderInlineFormatting(trimmed.replace(/^#\s+/, ''))}
          </h2>
        );
        return;
      }

      // Callouts / Blockquotes
      if (
        trimmed.startsWith('> ') ||
        trimmed.startsWith('**Key Takeaway:**') ||
        trimmed.startsWith('**Note:**') ||
        trimmed.startsWith('**Tip:**')
      ) {
        const cleanCallout = trimmed.startsWith('> ') ? trimmed.replace(/^>\s*/, '') : trimmed;
        result.push(
          <div key={`${parentKey}_${lineIdx}`} className="mayu-callout-card">
            <i className="fas fa-lightbulb" aria-hidden="true"></i>
            <div style={{ flex: 1 }}>{renderInlineFormatting(cleanCallout)}</div>
          </div>
        );
        return;
      }

      // Bullet points
      const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ');
      if (isBullet) {
        const bulletContent = trimmed.replace(/^[-•*]\s*/, '');
        result.push(
          <div key={`${parentKey}_${lineIdx}`} className="mayu-rich-list-item">
            <span className="mayu-list-bullet">✦</span>
            <span style={{ flex: 1, color: '#e2e8f0', lineHeight: '1.5' }}>
              {renderInlineFormatting(bulletContent)}
            </span>
          </div>
        );
        return;
      }

      // Numbered items: 1. Item
      const isNumbered = /^\d+\.\s/.test(trimmed);
      if (isNumbered) {
        const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
        if (numMatch) {
          result.push(
            <div key={`${parentKey}_${lineIdx}`} className="mayu-rich-list-item">
              <span className="mayu-list-number">{numMatch[1]}</span>
              <span style={{ flex: 1, color: '#e2e8f0', lineHeight: '1.5' }}>
                {renderInlineFormatting(numMatch[2])}
              </span>
            </div>
          );
          return;
        }
      }

      if (!trimmed) {
        result.push(<div key={`${parentKey}_${lineIdx}`} style={{ height: '6px' }} />);
        return;
      }

      result.push(
        <p key={`${parentKey}_${lineIdx}`} className="mayu-rich-p" style={{ margin: '0 0 6px 0', lineHeight: '1.55', color: '#e2e8f0' }}>
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });

    flushTable(lines.length);

    return <React.Fragment key={parentKey}>{result}</React.Fragment>;
  };

  return (
    <>
      <style>{`
        @keyframes mayuCompanionFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-7px) rotate(1.5deg); }
        }
        @keyframes mayuThinkingBob {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-3px) scale(1.04); }
        }
        @keyframes mayuPulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(99, 102, 241, 0.4), 0 0 30px rgba(56, 189, 248, 0.2); }
          50% { box-shadow: 0 0 25px rgba(99, 102, 241, 0.7), 0 0 45px rgba(56, 189, 248, 0.4); }
        }
        @keyframes mayuBubblePop {
          0% { opacity: 0; transform: translateY(12px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes mayuMessageSlide {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0px); }
        }
        .mayu-msg-entrance {
          animation: mayuMessageSlide 0.25s ease-out forwards;
        }

        /* Responsive Widget Placement */
        .mayu-widget-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          pointer-events: none;
        }

        .mayu-widget-container > * {
          pointer-events: auto;
        }

        .mayu-mascot-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(18, 18, 22, 0.94);
          border: 2px solid rgba(99, 102, 241, 0.55);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          padding: 0;
        }

        .mayu-chat-window {
          width: min(520px, calc(100vw - 28px));
          height: min(720px, calc(100vh - 80px));
          background-color: rgba(15, 17, 23, 0.97);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 20px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: height 0.25s ease, all 0.25s ease;
        }

        .mayu-chat-window.minimized {
          height: 60px !important;
        }

        /* Mobile specific positioning to prevent overlapping the single-row bottom navigation */
        @media (max-width: 767px) {
          .mayu-widget-container {
            /* Sits clearly ABOVE the fixed single-row mobile bottom navbar */
            bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
            right: calc(12px + env(safe-area-inset-right, 0px)) !important;
          }

          .mayu-mascot-btn {
            width: 46px !important;
            height: 46px !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
          }

          .mayu-chat-window {
            width: calc(100vw - 20px) !important;
            max-width: 480px !important;
            /* Fit comfortably within viewport above single-row bottom navigation */
            height: min(520px, calc(100vh - 82px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))) !important;
            border-radius: 16px !important;
          }

          .mayu-chat-window.minimized {
            height: 50px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mayu-widget-container .mayu-msg-entrance,
          .mayu-widget-container svg,
          .mayu-widget-container button {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* Floating Assistant Launcher Widget */}
      <div className="mayu-widget-container">
        {/* Welcome Greeting Speech Bubble on First Visit */}
        {showGreetingBubble && !isOpen && (
          <div
            style={{
              marginBottom: '12px',
              maxWidth: '290px',
              backgroundColor: 'rgba(24, 24, 27, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '16px',
              padding: '12px 16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(12px)',
              color: '#ffffff',
              fontSize: '0.85rem',
              lineHeight: '1.45',
              position: 'relative',
              animation: 'mayuBubblePop 0.35s ease-out forwards',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a5b4fc' }}>MAYU AI</span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              </div>
              <button
                type="button"
                onClick={() => setShowGreetingBubble(false)}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                aria-label="Dismiss greeting"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: 0, color: '#e4e4e7', fontSize: '0.82rem' }}>
              👋 Hi! I&apos;m MAYU AI, your personal companion to Mayur&apos;s digital world. Click me to explore projects, skills, or view an executive summary!
            </p>
          </div>
        )}

        {/* Floating Mascot Button */}
        {!isOpen && (
          <button
            type="button"
            className="mayu-mascot-btn"
            onClick={handleOpen}
            aria-label="Open MAYU AI companion assistant"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5)';
            }}
          >
            <MayuCompanionMascot size={44} mood={mascotMood} isThinking={isLoading} />
          </button>
        )}

        {/* Active Chat Panel */}
        {isOpen && (
          <div className={`mayu-chat-window ${isMinimized ? 'minimized' : ''}`}>
            {/* Header */}
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: 'rgba(24, 24, 27, 0.85)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MayuCompanionMascot size={36} mood={mascotMood} isThinking={isLoading} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#ffffff' }}>MAYU AI</span>
                    <button
                      type="button"
                      onClick={handleToggleRecruiterMode}
                      title="Toggle between friendly explorer and recruiter summary mode"
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: isRecruiterMode ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                        border: `1px solid ${isRecruiterMode ? '#a855f7' : 'rgba(255, 255, 255, 0.15)'}`,
                        color: isRecruiterMode ? '#c084fc' : '#a1a1aa',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="fas fa-briefcase" style={{ fontSize: '9px' }}></i>
                      <span>{isRecruiterMode ? 'Recruiter Mode' : 'Explorer'}</span>
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#a1a1aa', display: 'block' }}>
                    Your friendly guide to my digital world.
                  </span>
                </div>
              </div>

              {/* Window Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleResetConversation}
                  title="Reset conversation"
                  aria-label="Reset conversation"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    padding: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderRadius: '6px',
                  }}
                >
                  <i className="fas fa-redo-alt"></i>
                </button>

                <button
                  type="button"
                  onClick={handleToggleMinimize}
                  title={isMinimized ? 'Expand' : 'Minimize'}
                  aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    padding: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderRadius: '6px',
                  }}
                >
                  <i className={isMinimized ? 'fas fa-chevron-up' : 'fas fa-minus'}></i>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  title="Close assistant"
                  aria-label="Close assistant"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    padding: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderRadius: '6px',
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Body */}
            {!isMinimized && (
              <>
                {/* Scrollable Chat Area */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    fontSize: '0.86rem',
                  }}
                >
                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    const isCopied = copiedMessageId === m.id;

                    return (
                      <div
                        key={m.id}
                        className="mayu-msg-entrance"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isUser ? 'flex-end' : 'flex-start',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: isUser ? '82%' : '94%',
                            padding: '12px 16px',
                            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            backgroundColor: isUser
                              ? '#4f46e5'
                              : 'rgba(25, 27, 36, 0.88)',
                            border: isUser
                              ? '1px solid rgba(129, 140, 248, 0.4)'
                              : '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#ffffff',
                            boxShadow: isUser
                              ? '0 3px 10px rgba(79, 70, 229, 0.3)'
                              : '0 3px 10px rgba(0, 0, 0, 0.3)',
                            fontSize: '0.88rem',
                            lineHeight: '1.5',
                            wordBreak: 'break-word',
                            position: 'relative',
                          }}
                        >
                          {isUser ? (
                            <p style={{ margin: 0, lineHeight: '1.45' }}>{m.text}</p>
                          ) : (
                            <>
                              {/* Top bar with Copy Action */}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'flex-end',
                                  marginBottom: '6px',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(m.text, m.id)}
                                  title="Copy response to clipboard"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '6px',
                                    padding: '3px 7px',
                                    fontSize: '0.68rem',
                                    color: isCopied ? '#34d399' : '#94a3b8',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <i className={isCopied ? 'fas fa-check' : 'fas fa-copy'} style={{ fontSize: '10px' }}></i>
                                  <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>

                              {renderMessageContent(m.text)}
                            </>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: '#71717a',
                            marginTop: '3px',
                            padding: '0 4px',
                          }}
                        >
                          {m.timestamp}
                        </span>
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', fontSize: '0.8rem' }}>
                      <MayuCompanionMascot size={26} mood="thinking" isThinking={true} />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <span>MAYU AI is thinking</span>
                        <span className="dot1">.</span>
                        <span className="dot2">.</span>
                        <span className="dot3">.</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Suggestions Dock: compact single-line horizontal track above input, continuously active */}
                {!isLoading && (
                  <div
                    className="mayu-suggestions-dock"
                    role="region"
                    aria-label="Suggested topics"
                  >
                    <div className="mayu-suggestions-dock-label">
                      <i className="fas fa-sparkles" aria-hidden="true"></i>
                      <span>Suggestions:</span>
                    </div>
                    <div className="mayu-suggestions-dock-track">
                      {getContextualSuggestions(messages).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="mayu-suggestion-dock-chip"
                          onClick={() => handleSendMessage(item.question)}
                          title={`Ask: "${item.question}"`}
                        >
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'rgba(20, 20, 24, 0.95)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask about projects, skills, education..."
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />

                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    aria-label="Send message"
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: inputValue.trim() && !isLoading
                        ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                        : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: inputValue.trim() && !isLoading ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <i className="fas fa-paper-plane" style={{ fontSize: '13px' }}></i>
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};
