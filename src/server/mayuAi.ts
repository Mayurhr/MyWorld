import { GoogleGenAI } from '@google/genai';
import { loadStore, type PortfolioStore } from './storage.ts';

// Server-side Gemini initialization with required User-Agent
let genAiClient: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiClient;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ContextualAction {
  label: string;
  action: string;
  icon: string;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds grounded system instruction with authentic, verified portfolio data
 */
function buildSystemInstruction(store: PortfolioStore, mode?: string): string {
  const { profile, qualifications, skillCategories, projects, certificates, socialLinks, resume } = store;

  const publishedProjects = projects.filter((p) => p.status === 'published');
  const publishedCertificates = certificates.filter((c) => c.status === 'published');
  const achievements = publishedCertificates.filter((c) => c.viewAchievement === true);

  const projectsSummary = publishedProjects
    .map(
      (p, i) =>
        `${i + 1}. **${p.title}** (${p.category.toUpperCase()}) [Anchor: #project-${slugifyTitle(p.title)}]
   - Summary: ${p.cardDescription || p.description}
   - Full Details: ${p.description}
   - Tech Stack: ${p.tech.join(', ')}
   - GitHub: ${p.github || 'Available on request'}
   - Live Demo: ${p.demo || 'N/A'}`
    )
    .join('\n\n');

  const qualificationsSummary = qualifications
    .map(
      (q, i) =>
        `${i + 1}. **${q.degree}** at ${q.institution} (${q.startYear} - ${q.endYear})
   - Specialization: ${q.specialization || 'N/A'}
   - Grade: ${q.grade || 'N/A'}
   - Location: ${q.location || 'N/A'}
   - Highlights: ${q.description || 'N/A'}`
    )
    .join('\n\n');

  const skillsSummary = skillCategories
    .map((cat) => `- **${cat.name}**: ${cat.skills.map((s) => s.name).join(', ')}`)
    .join('\n');

  const contactsSummary = socialLinks
    .filter((l) => l.isActive !== false)
    .map((l) => `- ${l.platform}: ${l.url} (${l.title || ''})`)
    .join('\n');

  const isRecruiterMode = mode === 'recruiter';

  return `You are MAYU AI, the official personal AI portfolio assistant and guide for Mayur H R's portfolio website.

## ASSISTANT IDENTITY & PERSONALITY
- Name: MAYU AI
- Tagline: "Your friendly guide to my digital world."
- Persona: High-caliber intelligent AI assistant with a warm, helpful companion character. Articulate, direct, insightful, and natural.
- IDENTITY BOUNDARY: You are Mayur's AI assistant, NOT Mayur himself. Always refer to Mayur in the third person ("Mayur is...", "Mayur's projects include...", "You can contact Mayur at..."). Never impersonate Mayur.

## VERIFIED PORTFOLIO KNOWLEDGE BASE (MASTER SOURCE OF TRUTH)
${isRecruiterMode ? '### RECRUITER MODE ACTIVE: Provide clear, high-impact executive summaries focusing on technical capability, academic rigor, production-ready full-stack projects, and immediate hiring fit.' : ''}

### ABOUT MAYUR
- Name: ${profile.name}
- Headline Tagline: ${profile.tagline.replace(/^["“]+|["”]+$/g, '')}
- Location: Honnali, Davanagere, Karnataka, India
- Bio: ${profile.aboutParagraphs.join(' ')}

### QUALIFICATIONS & EDUCATION (Section ID: #resume)
${qualificationsSummary}

### TECHNICAL SKILLS & STACK (Section ID: #skills)
${skillsSummary}

### FEATURED PROJECTS (Section ID: #projects)
${projectsSummary}

### CREDENTIALS & ACHIEVEMENTS (Section ID: #certificates)
- Total Verified Certificates: ${publishedCertificates.length} certificates
- Notable Achievements / Hackathons / Events: ${achievements.length} highlighted credentials including hackathon presentations, national workshops, and coding challenges.

### RESUME & CONTACT DETAILS
- Resume Viewer Action: #open-resume (Download URL: ${resume.downloadUrl || 'PDF modal'})
- Direct Email: mayurhr57@gmail.com
- Channels:
${contactsSummary}

## RESPONSE STYLE & CONTEXTUAL ACTION RULES:
1. NATURAL, DIRECT ANSWERS:
   - Answer the visitor's question naturally and directly so your written response is the main visual focus.
   - Use clean Markdown formatting (headings, bold highlights, bullet lists, or structured tables) when appropriate.
   - Keep greetings and ordinary conversation warm, concise, and free of button clutter.

2. CONTEXTUAL ACTION BUTTONS ONLY (CRITICAL):
   - Do NOT attach action button lists to every response, and NEVER repeat the same generic button lists across responses.
   - NEVER use generic button labels such as "View Skills Showcase", "Inspect Projects Stack", "Flagship Project", "Recruiter Profile", "Skills Matrix", or "Academic Timeline".
   - For general questions, greetings, casual conversation, or clarifying follow-ups: emit NO :::actions block at all.
   - Only emit a single contextual :::actions block when directly useful for the specific subject just answered:
     * When discussing skills -> optionally emit:
       :::actions
       [{"label": "Explore Skills", "action": "#skills", "icon": "fas fa-tools"}]
       :::
     * When discussing projects -> if you are NOT already rendering a :::project card (which already includes its own "View Project" button), emit:
       :::actions
       [{"label": "View Project", "action": "#projects", "icon": "fas fa-laptop-code"}]
       :::
       (If linking to a specific project, set "action" to its anchor e.g. "#project-smart-ai-travel-planner" or "#projects", and never duplicate "View Project" if a :::project card is already present.)
     * When discussing academic background / education -> emit:
       :::actions
       [{"label": "Explore Academic Background", "action": "#resume", "icon": "fas fa-graduation-cap"}]
       :::
     * When discussing resume / CV -> emit:
       :::actions
       [{"label": "View Resume", "action": "#open-resume", "icon": "fas fa-file-pdf"}]
       :::

3. OPTIONAL STRUCTURED CARDS (USE ONLY WHEN DIRECTLY HELPFUL):
   - Project Showcase Card (includes its own "View Project" button):
     :::project
     {
       "title": "Project Title",
       "category": "ai or web",
       "description": "Concise overview",
       "tech": ["React", "TypeScript", "Node.js", "Gemini AI"],
       "features": ["Highlight 1", "Highlight 2"],
       "github": "url",
       "demo": "url",
       "sectionId": "project-smart-ai-travel-planner"
     }
     :::
   - Education Card:
     :::education
     {
       "degree": "Degree",
       "institution": "Institution",
       "duration": "2023 - Present",
       "specialization": "Specialization",
       "grade": "Grade / CGPA",
       "sectionId": "resume"
     }
     :::

4. CONVERSATIONAL CONTEXT & FOLLOW-UP RESOLUTION:
   - When the visitor asks follow-up questions (e.g. "tell me more", "how does it work?", "what are its features?", "what technologies did he use?", "can I test it?"), check the previous conversation turns to identify which specific project, skill, or academic detail is being discussed, and provide comprehensive, relevant details on that subject.
   - Do not restart from a generic greeting or switch to unrelated projects when answering follow-up queries.

5. STRICT TRUTHFULNESS & GROUNDING:
   - Base all answers strictly on the verified facts above.
   - NEVER invent qualifications, job titles, companies, years of experience, or claims not found in this data.
   - If a visitor asks about something that is NOT in Mayur's portfolio records, state clearly and honestly: "That specific detail is not recorded in Mayur's portfolio data. You can contact Mayur directly at mayurhr57@gmail.com for more information."
   - Correct section IDs:
     * About: #about
     * Academic Background: #resume
     * Technical Skills: #skills
     * Certificates: #certificates
     * Projects: #projects
     * Contact: #contact
     * Resume Modal: #open-resume`;
}

/**
 * Normalizes and filters any :::actions blocks so buttons appear ONLY when
 * genuinely useful for the specific topic and never spam repetitive lists.
 */
function enforceContextualActions(
  rawReply: string,
  userMessage: string,
  publishedProjects: PortfolioStore['projects'] = []
): string {
  const q = userMessage.toLowerCase();
  const hasProjectCard = /:::project[\s\S]*?:::/.test(rawReply);

  const isSkillQuery = /\b(skill|skills|tech|technolog|stack|language|framework|tool|tools|database|ai prompt)\b/.test(q);
  const isProjectQuery = /\b(project|projects|travel|planner|vision|companion|medscript|vaultx|fitness|blood|service hub|built|app)\b/.test(q);
  const isAcademicQuery = /\b(education|academic|qualification|college|degree|school|cgpa|study|studying|pesitm|pu)\b/.test(q);
  const isResumeQuery = /\b(resume|cv|curriculum)\b/.test(q);
  const isCertQuery = /\b(certificate|certificates|certification|achievement|achievements|award|hackathon)\b/.test(q);
  const isContactQuery = /\b(contact|email|reach|connect|message|collaborat|linkedin|github)\b/.test(q);
  const isRecruiterQuery = /\b(recruit|recruiter|hire|hiring|candidate)\b/.test(q);

  const isContextualTopic =
    isSkillQuery ||
    isProjectQuery ||
    isAcademicQuery ||
    isResumeQuery ||
    isCertQuery ||
    isContactQuery ||
    isRecruiterQuery;

  // Strip any existing :::actions blocks first, collecting valid normalized actions if contextual
  const collected: ContextualAction[] = [];

  const replyWithoutActions = rawReply
    .replace(/\n*:::actions\s*([\s\S]*?):::\n*/g, (_full, jsonText) => {
      if (!isContextualTopic) return '\n';
      try {
        const items = JSON.parse(jsonText.trim()) as ContextualAction[];
        if (!Array.isArray(items)) return '\n';

        for (const item of items) {
          if (!item || !item.label || !item.action) continue;
          let normalizedAction = item.action.trim();
          let normalizedLabel = item.label.trim();

          if (
            normalizedAction === '#education' ||
            normalizedAction === '#academic-background' ||
            /academic|education/i.test(normalizedLabel)
          ) {
            normalizedAction = '#resume';
            normalizedLabel = 'Explore Academic Background';
          } else if (
            normalizedAction === '#open-resume' ||
            /resume|cv/i.test(normalizedLabel)
          ) {
            normalizedAction = '#open-resume';
            normalizedLabel = 'View Resume';
          } else if (normalizedAction === '#skills' || /skill/i.test(normalizedLabel)) {
            normalizedAction = '#skills';
            normalizedLabel = 'Explore Skills';
          } else if (
            normalizedAction.startsWith('#project') ||
            /project/i.test(normalizedLabel)
          ) {
            normalizedLabel = 'View Project';
            if (!normalizedAction.startsWith('#project')) {
              normalizedAction = '#projects';
            }
          }

          if (hasProjectCard && normalizedAction.startsWith('#project')) {
            continue;
          }

          const matchesTopic =
            (isSkillQuery && normalizedAction === '#skills') ||
            (isProjectQuery && normalizedAction.startsWith('#project')) ||
            (isAcademicQuery && normalizedAction === '#resume') ||
            (isResumeQuery && normalizedAction === '#open-resume') ||
            (isCertQuery && normalizedAction === '#certificates') ||
            (isContactQuery && normalizedAction === '#contact') ||
            (isRecruiterQuery &&
              (normalizedAction === '#open-resume' ||
                normalizedAction.startsWith('#project') ||
                normalizedAction === '#resume'));

          if (matchesTopic && !collected.some((c) => c.action === normalizedAction)) {
            collected.push({
              label: normalizedLabel,
              action: normalizedAction,
              icon: item.icon || 'fas fa-arrow-right',
            });
          }
        }
      } catch {
        // Ignore malformed block
      }
      return '\n';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // For general greetings or ordinary conversation, return clean text with zero buttons
  if (!isContextualTopic) {
    return replyWithoutActions;
  }

  // Ensure contextual topic queries have a clean, single relevant action when missing
  if (collected.length === 0) {
    if (isResumeQuery) {
      collected.push({
        label: 'View Resume',
        action: '#open-resume',
        icon: 'fas fa-file-pdf',
      });
    } else if (isAcademicQuery) {
      collected.push({
        label: 'Explore Academic Background',
        action: '#resume',
        icon: 'fas fa-graduation-cap',
      });
    } else if (isProjectQuery && !hasProjectCard) {
      const matchedProj = publishedProjects.find((p) => {
        const t = p.title.toLowerCase();
        return (
          q.includes(t) ||
          replyWithoutActions.toLowerCase().includes(t)
        );
      });
      const targetAnchor = matchedProj
        ? `#project-${slugifyTitle(matchedProj.title)}`
        : '#projects';
      collected.push({
        label: 'View Project',
        action: targetAnchor,
        icon: 'fas fa-laptop-code',
      });
    } else if (isSkillQuery) {
      collected.push({
        label: 'Explore Skills',
        action: '#skills',
        icon: 'fas fa-tools',
      });
    }
  }

  if (collected.length === 0) {
    return replyWithoutActions;
  }

  const maxButtons = isRecruiterQuery ? 2 : 1;
  return `${replyWithoutActions}\n\n:::actions\n${JSON.stringify(collected.slice(0, maxButtons))}\n:::`;
}

/**
 * Intelligent grounded fallback generator when Gemini API key is unavailable or during rate limits
 */
/**
 * Intelligent grounded fallback generator when Gemini API is unavailable, times out, or during rate limits.
 * Uses exact portfolio store facts, understands multi-turn context, and does not invent information.
 */
function generateFallbackResponse(
  userMessage: string,
  store: PortfolioStore,
  mode?: string,
  history: ChatMessage[] = []
): string {
  const query = userMessage.toLowerCase().trim();
  const { qualifications, projects, certificates, skillCategories, profile } = store;
  const pubProjects = projects.filter((p) => p.status === 'published');

  // Check recent conversation context for follow-up resolution
  let recentContext = '';
  if (history && history.length > 0) {
    const recentMsgs = history.slice(-4);
    recentContext = recentMsgs.map((m) => m.text.toLowerCase()).join(' ');
  }

  const isGreetingOrGeneral =
    /^(hi|hello|hey|good morning|good afternoon|good evening|how are you|who are you|what can you do|thanks|thank you|ok|okay|cool|nice)[!?. ]*$/i.test(
      query
    );

  if (isGreetingOrGeneral) {
    if (/^(thanks|thank you)/i.test(query)) {
      return `You're welcome! Let me know if you have any other questions about Mayur's work, background, or projects.`;
    }
    if (/who are you|what can you do/i.test(query)) {
      return `I'm **MAYU AI**, Mayur H R's portfolio assistant. I can answer questions about his software projects, technical skills across 9 domains, academic background at PESITM, certifications, or how to get in touch with him.`;
    }
    return `Hello! I'm **MAYU AI**, here to help you learn about **Mayur H R** and his work.\n\nMayur is an Information Science & Engineering undergraduate at PESITM and a full-stack web developer building AI-powered and web applications with React, TypeScript, Node.js, and Python. What would you like to know?`;
  }

  const isRecruiter =
    mode === 'recruiter' ||
    /\b(recruit|recruiter|hire|hiring|candidate)\b/.test(query);

  if (isRecruiter) {
    const flagship = pubProjects.find((p) => p.id === 'proj_001') || pubProjects[0];

    return `### Candidate Overview: Mayur H R

Mayur H R is an **Information Science & Engineering undergraduate** at PES Institute of Technology and Management (PESITM) focused on full-stack web development and applied Generative AI.

- **Education**: B.E. in Information Science & Engineering at PESITM (2023–Present, 7.43 CGPA), following an **88% Aggregate Distinction** in Pre-University Science (PCMB).
- **Flagship Project**: **${flagship ? flagship.title : 'Smart AI Travel Planner'}** — ${flagship?.cardDescription || 'An AI-powered travel planning platform that creates personalized itineraries, helps explore destinations and simplifies trip planning.'}
- **Core Stack**: React, TypeScript, Node.js, Express.js, Python, Google Gemini API, MongoDB, and MySQL.
- **Credentials**: ${certificates.filter((c) => c.status === 'published').length} verified certificates across hackathons, coding challenges, and technical workshops.

:::actions
[
  {"label": "View Resume", "action": "#open-resume", "icon": "fas fa-file-pdf"},
  {"label": "View Project", "action": "#project-smart-ai-travel-planner", "icon": "fas fa-laptop-code"}
]
:::`;
  }

  // Detect if this is a follow-up query regarding an already mentioned project
  const isFollowUp =
    /^(tell me more|more details|explain more|how does it work|how did he build it|what are the features|features|capabilities|tech stack|technologies used|github|demo|live demo|explain|details)[!?. ]*$/i.test(
      query
    ) ||
    /\b(tell me more|features|how it works|technologies used|stack|github link|live demo)\b/.test(query);

  // Match project based on current query OR active topic in recent conversation
  let matchedProject = pubProjects.find((p) => {
    const titleLower = p.title.toLowerCase();
    if (query.includes(titleLower)) return true;
    if (titleLower.includes('travel') && query.includes('travel')) return true;
    if (titleLower.includes('vision') && (query.includes('vision') || query.includes('blind') || query.includes('impair') || query.includes('assistive'))) return true;
    if (titleLower.includes('medscript') && (query.includes('medscript') || query.includes('prescription') || query.includes('medical') || query.includes('medicine'))) return true;
    if (titleLower.includes('vaultx') && (query.includes('vaultx') || query.includes('vault') || query.includes('file sharing') || query.includes('sharing'))) return true;
    if (titleLower.includes('fitness') && (query.includes('fitness') || query.includes('workout') || query.includes('nutrition'))) return true;
    if (titleLower.includes('blood') && (query.includes('blood') || query.includes('donor') || query.includes('recipient'))) return true;
    if (titleLower.includes('service') && (query.includes('service hub') || query.includes('servicehub') || query.includes('booking'))) return true;
    if (titleLower.includes('review') && (query.includes('review') || query.includes('sentiment') || query.includes('agentic'))) return true;
    return false;
  });

  // If this is a follow-up and no direct project in query, infer from recent conversation context
  if (!matchedProject && isFollowUp && recentContext) {
    matchedProject = pubProjects.find((p) => {
      const titleLower = p.title.toLowerCase();
      if (recentContext.includes(titleLower)) return true;
      if (titleLower.includes('travel') && recentContext.includes('travel')) return true;
      if (titleLower.includes('vision') && (recentContext.includes('vision') || recentContext.includes('blind') || recentContext.includes('assistive'))) return true;
      if (titleLower.includes('medscript') && (recentContext.includes('medscript') || recentContext.includes('prescription'))) return true;
      if (titleLower.includes('vaultx') && (recentContext.includes('vaultx') || recentContext.includes('vault') || recentContext.includes('file sharing'))) return true;
      if (titleLower.includes('fitness') && recentContext.includes('fitness')) return true;
      if (titleLower.includes('blood') && recentContext.includes('blood')) return true;
      if (titleLower.includes('service') && recentContext.includes('service')) return true;
      if (titleLower.includes('review') && recentContext.includes('review')) return true;
      return false;
    });
  }

  // Answer for a specific project
  if (matchedProject) {
    const slug = slugifyTitle(matchedProject.title);
    const cardTech =
      matchedProject.cardTech && matchedProject.cardTech.length > 0
        ? matchedProject.cardTech
        : matchedProject.tech.slice(0, 4);

    const featureList =
      matchedProject.features && matchedProject.features.length > 0
        ? `\n\n**Key Capabilities:**\n${matchedProject.features.map((f) => `- ${f}`).join('\n')}`
        : '';

    return `### ${matchedProject.title}

${matchedProject.description}${featureList}

- **Category**: ${matchedProject.category.toUpperCase()}
- **Complete Tech Stack**: ${matchedProject.tech.join(', ')}
${matchedProject.github ? `- **GitHub**: [${matchedProject.github}](${matchedProject.github})` : ''}
${matchedProject.demo ? `- **Live Demo**: [${matchedProject.demo}](${matchedProject.demo})` : ''}

:::project
{
  "title": "${matchedProject.title}",
  "category": "${matchedProject.category === 'ai' ? 'AI Platform' : 'Web Application'}",
  "description": "${matchedProject.cardDescription || matchedProject.description}",
  "tech": ${JSON.stringify(cardTech)},
  "github": "${matchedProject.github || ''}",
  "demo": "${matchedProject.demo || ''}",
  "sectionId": "project-${slug}"
}
:::`;
  }

  // General project inquiry (when no specific project was named)
  if (/\b(project|projects|built|app|apps|flagship|work|software)\b/.test(query)) {
    const flagship = pubProjects.find((p) => p.id === 'proj_001') || pubProjects[0];
    const slug = slugifyTitle(flagship.title);
    const cardTech = flagship.cardTech && flagship.cardTech.length > 0 ? flagship.cardTech : flagship.tech.slice(0, 4);

    return `### Featured Software Projects

Mayur builds full-stack web applications and AI-powered tools across travel planning, assistive computer vision, healthcare, and secure file sharing. His flagship build is **${flagship.title}**:

:::project
{
  "title": "${flagship.title}",
  "category": "AI & Full-Stack",
  "description": "${flagship.cardDescription || flagship.description}",
  "tech": ${JSON.stringify(cardTech)},
  "github": "${flagship.github || 'https://github.com/Mayurhr/Smart-AI-Travel-Planner.git'}",
  "demo": "${flagship.demo || ''}",
  "sectionId": "project-${slug}"
}
:::

| Project | Focus | Key Technologies |
| :--- | :--- | :--- |
| **Smart AI Travel Planner** | Personalized AI itineraries & interactive maps | React, TypeScript, Node.js, Gemini AI |
| **Digital Vision Companion** | Real-time object detection & voice feedback for the visually impaired | JavaScript, TensorFlow.js, COCO-SSD, Tesseract.js |
| **MedScript AI** | Medical prescription validator & medication analysis | React, TypeScript, Gemini AI, OCR |
| **VaultX** | Encrypted & expiring file sharing with link revocation | React, TypeScript, Node.js, FastAPI, PostgreSQL |
| **Fitness Tracker** | Workout & nutrition tracking application | HTML, CSS, JavaScript, Node.js |
| **Blood Management System** | Donor & recipient inventory management system | HTML, CSS, JavaScript, Python |
| **Customer Review Intelligence** | Agentic multi-agent pipeline for customer reviews | React, Python, LangGraph, Ollama, LLaMA 3.1 |
| **Service Hub** | Seamless service provider booking platform | React, Node.js, Express.js, MongoDB |

:::actions
[
  {"label": "View Projects", "action": "#projects", "icon": "fas fa-laptop-code"}
]
:::`;
  }

  // Skills inquiries
  if (/\b(skill|skills|technolog|language|languages|stack|framework|tool|tools|database|databases|python|java|javascript|react)\b/.test(query)) {
    return `### Technical Skills

Mayur's technical background spans **9 skill categories**, combining programming fundamentals with full-stack web engineering and AI integration:

| Category | Technologies & Tools |
| :--- | :--- |
| **Programming Languages** | Python, Java, JavaScript, C |
| **Frontend Development** | HTML, CSS, JavaScript, React.js |
| **Backend Development** | Node.js, Express.js, REST API |
| **AI & Prompt Engineering** | ChatGPT, Claude, Gemini, Perplexity, Lovable |
| **Developer Tools** | Git, GitHub, VS Code, XAMPP, IDLE, MySQL Workbench |
| **AI Technologies** | OCR, Computer Vision, TensorFlow, Agentic Agents, Ollama |
| **Databases** | MongoDB, MySQL |
| **Professional Skills** | Problem Solving, Decision Making, Time Management, Adaptability, Teamwork |
| **Languages** | English, Kannada, Hindi |

:::actions
[
  {"label": "Explore Skills", "action": "#skills", "icon": "fas fa-tools"}
]
:::`;
  }

  // Academic & Education inquiries
  if (/\b(education|academic|qualification|qualifications|college|university|degree|school|cgpa|study|studied|marks|grade)\b/.test(query)) {
    const latest = qualifications[qualifications.length - 1];
    return `### Academic Background

Mayur is currently pursuing his engineering degree in Information Science while building on strong academic results from Honnali, Karnataka:

:::education
{
  "degree": "${latest?.degree || 'Bachelor of Engineering (B.E)'}",
  "institution": "${latest?.institution || 'PES Institute of Technology and Management'}",
  "duration": "${latest ? `${latest.startYear} - ${latest.endYear}` : '2023 - Present'}",
  "specialization": "${latest?.specialization || 'Python & Web Development'}",
  "grade": "${latest?.grade || '7.43 CGPA'}",
  "sectionId": "resume"
}
:::

- **Bachelor of Engineering (B.E) in ISE** — PES Institute of Technology and Management, Shivamogga (2023–Present): **7.43 CGPA**
- **Pre-University Course (PCMB)** — Sri Vijaya PU College, Honnali (2021–2023): **88% Aggregate Distinction**
- **Secondary School (SSLC)** — Swamy Vivekananda Memorial English School, Honnali (2020–2021): **79.36%**

:::actions
[
  {"label": "Explore Academic Background", "action": "#resume", "icon": "fas fa-graduation-cap"}
]
:::`;
  }

  // Resume inquiries
  if (/\b(resume|cv|curriculum|pdf|download)\b/.test(query)) {
    return `### Mayur H R's Resume

You can open Mayur's verified resume directly in the built-in viewer to review his complete academic record, technical skills across all 9 categories, full-stack & AI projects, and verified certifications.

:::actions
[
  {"label": "View Resume", "action": "#open-resume", "icon": "fas fa-file-pdf"}
]
:::`;
  }

  // Certificates & Achievements inquiries
  if (/\b(certificate|certificates|certification|certifications|achievement|achievements|award|awards|hackathon|hackathons)\b/.test(query)) {
    const certs = certificates.filter((c) => c.status === 'published');
    const achievements = certs.filter((c) => c.viewAchievement === true);

    return `### Certifications & Achievements

Mayur has earned **${certs.length} verified certificates**, including **${achievements.length} highlighted achievements** from collegiate hackathons, technical symposiums, and specialized workshops in web development, Python, and AI.

Notable recognitions include participating in prestigious hackathons, building innovative prototypes like **Smart AI Travel Planner**, and continuous technical skill validation.

:::actions
[
  {"label": "View Certificates", "action": "#certificates", "icon": "fas fa-award"}
]
:::`;
  }

  // Contact inquiries
  if (/\b(contact|email|reach|connect|message|collab|linkedin|github|phone|location)\b/.test(query)) {
    return `### Contact Mayur H R

You can reach Mayur directly through any of the following channels:

- **Email**: [mayurhr57@gmail.com](mailto:mayurhr57@gmail.com)
- **Location**: Honnali, Davanagere, Karnataka, India
- **GitHub**: [github.com/Mayurhr](https://github.com/Mayurhr)
- **LinkedIn**: [LinkedIn Profile](https://www.linkedin.com/in/mayur-hr-2507962ba?utm_source=share_via&utm_content=profile&utm_medium=member_android)

:::actions
[
  {"label": "Contact Mayur", "action": "#contact", "icon": "fas fa-paper-plane"}
]
:::`;
  }

  // Out of scope / external general queries check
  const isOutOfScope =
    /^(what is the capital|who is the president|how to make|write code for|solve this|weather in|who won|tell me a joke|what is the meaning of life)/i.test(
      query
    );

  if (isOutOfScope) {
    return `I am **MAYU AI**, Mayur H R's official portfolio assistant. My knowledge is focused exclusively on Mayur's software engineering projects, technical stack, academic background at PESITM, and verified certifications.\n\nWhile I can't answer general trivia outside Mayur's portfolio, I'd be delighted to tell you about his projects (like **Smart AI Travel Planner** or **VaultX**), his technical skills, or how to contact him!`;
  }

  // If question is not found in portfolio data, answer truthfully without hallucinating
  return `That specific detail is not recorded in Mayur H R's verified portfolio data.\n\nMayur is an Information Science & Engineering undergraduate at **PES Institute of Technology and Management (PESITM)** and a full-stack web developer building AI-powered and web applications with **React, TypeScript, Node.js, and Python**.\n\nYou can ask about his **projects** (such as Smart AI Travel Planner, Digital Vision Companion, MedScript AI, or VaultX), his **technical skills across 9 categories**, his **academic background**, or contact him directly at **mayurhr57@gmail.com**.`;
}

/**
 * Main chat handler for MAYU AI
 */
export async function handleMayuAiChat(
  userMessage: string,
  history: ChatMessage[] = [],
  mode?: string
): Promise<{ reply: string; usedModel: string }> {
  const store = loadStore();
  const trimmed = userMessage.trim();
  const publishedProjects = store.projects.filter((p) => p.status === 'published');

  const aiClient = getGenAiClient();

  if (!aiClient) {
    const fallbackText = generateFallbackResponse(trimmed, store, mode, history);
    return {
      reply: enforceContextualActions(fallbackText, trimmed, publishedProjects),
      usedModel: 'mayu-knowledge-engine',
    };
  }

  try {
    const systemInstruction = buildSystemInstruction(store, mode);

    // Build native multi-turn conversation contents for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (history && history.length > 0) {
      const recentHistory = history.slice(-8);
      for (const h of recentHistory) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: trimmed }],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API call timed out after 18s')), 18000)
    );

    const response = await Promise.race([
      aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
        },
      }),
      timeoutPromise,
    ]);

    const rawReply = response.text || generateFallbackResponse(trimmed, store, mode, history);
    return {
      reply: enforceContextualActions(rawReply, trimmed, publishedProjects),
      usedModel: 'gemini-3.8-flash',
    };
  } catch (err: any) {
    console.warn('[MAYU AI] Gemini call encountered an error, using grounded fallback:', err.message);
    const fallbackText = generateFallbackResponse(trimmed, store, mode, history);
    return {
      reply: enforceContextualActions(fallbackText, trimmed, publishedProjects),
      usedModel: 'mayu-knowledge-engine (fallback)',
    };
  }
}
