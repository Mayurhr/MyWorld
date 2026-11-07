export interface QualificationItem {
  id: string;
  degree: string;
  institution: string;
  specialization?: string;
  startYear: string;
  endYear: string;
  grade?: string;
  location?: string;
  description?: string;
  order: number;
  status: 'draft' | 'published';
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillItem {
  id: string;
  name: string;
  icon?: string;
  order: number;
}

export interface SkillCategoryItem {
  id: string;
  name: string;
  icon?: string;
  order: number;
  skills: SkillItem[];
  status: 'draft' | 'published';
  updatedAt?: string;
}

export interface SocialLinkItem {
  id: string;
  platform: string;
  url: string;
  icon: string;
  title?: string;
  order: number;
  isActive: boolean;
  updatedAt?: string;
}

export const DEFAULT_QUALIFICATIONS: QualificationItem[] = [
  {
    id: 'qual_001',
    degree: 'Secondary School Leaving Certificate (SSLC)',
    institution: 'Swamy Vivekananda Memorial English School',
    specialization: 'General Science & Mathematics',
    startYear: '2020',
    endYear: '2021',
    grade: '79.36%',
    location: 'Honnali, Davanagere',
    description: 'Completed Secondary School Leaving Certificate (SSLC) with 79.36% (State Board).\n• Active participant in science exhibitions and cultural activities',
    order: 1,
    status: 'published',
  },
  {
    id: 'qual_002',
    degree: 'Pre-University Course (PCMB)',
    institution: 'Sri Vijaya PU College',
    specialization: 'PCMB (Physics, Chemistry, Mathematics, Biology)',
    startYear: '2021',
    endYear: '2023',
    grade: '88% Aggregate',
    location: 'Honnali, Karnataka',
    description: 'Pre-University Course (PCMB) completed with 88% distinction.\n• Scored 88% in final examinations\n• Participant in Science and Mathematics forums',
    order: 2,
    status: 'published',
  },
  {
    id: 'qual_003',
    degree: 'Bachelor of Engineering in Information Science & Engineering',
    institution: 'PES Institute of Technology and Management',
    specialization: 'Python & Web Development',
    startYear: '2023',
    endYear: 'Present',
    grade: '7.43 CGPA',
    location: 'Shivamogga, Karnataka',
    description: "Currently pursuing Bachelor of Engineering in Information Science & Engineering.\n• Specializing in Python & Web Development\n• Participant in hackathons, seminars, and technical paper presentations",
    order: 3,
    status: 'published',
  },
];

export const DEFAULT_SKILL_CATEGORIES: SkillCategoryItem[] = [
  {
    id: 'cat_prog_lang',
    name: 'Programming Languages',
    icon: 'fas fa-code',
    order: 1,
    status: 'published',
    skills: [
      { id: 'sk_python', name: 'Python', icon: 'fab fa-python python-icon', order: 1 },
      { id: 'sk_java', name: 'Java', icon: 'fab fa-java java-icon', order: 2 },
      { id: 'sk_js', name: 'JavaScript', icon: 'fab fa-js js-icon', order: 3 },
      { id: 'sk_c', name: 'C', icon: 'fab fa-cuttlefish c-icon', order: 4 },
    ],
  },
  {
    id: 'cat_frontend',
    name: 'Frontend Development',
    icon: 'fas fa-laptop-code',
    order: 2,
    status: 'published',
    skills: [
      { id: 'sk_html', name: 'HTML', icon: 'fab fa-html5 html-icon', order: 1 },
      { id: 'sk_css', name: 'CSS', icon: 'fab fa-css3-alt css-icon', order: 2 },
      { id: 'sk_js_fe', name: 'JavaScript', icon: 'fab fa-js js-icon', order: 3 },
      { id: 'sk_react', name: 'React.js', icon: 'fab fa-react react-icon', order: 4 },
    ],
  },
  {
    id: 'cat_backend',
    name: 'Backend Development',
    icon: 'fas fa-server',
    order: 3,
    status: 'published',
    skills: [
      { id: 'sk_node', name: 'Node.js', icon: 'fab fa-node-js node-icon', order: 1 },
      { id: 'sk_express', name: 'Express.js', icon: 'fas fa-server express-icon', order: 2 },
      { id: 'sk_rest', name: 'REST API', icon: 'fas fa-plug', order: 3 },
    ],
  },
  {
    id: 'cat_ai_prompt',
    name: 'AI & Prompt Engineering',
    icon: 'fas fa-brain',
    order: 4,
    status: 'published',
    skills: [
      { id: 'sk_chatgpt', name: 'ChatGPT', icon: 'fas fa-comments', order: 1 },
      { id: 'sk_claude', name: 'Claude', icon: 'fas fa-brain', order: 2 },
      { id: 'sk_gemini', name: 'Gemini', icon: 'fas fa-star', order: 3 },
      { id: 'sk_perplexity', name: 'Perplexity', icon: 'fas fa-search', order: 4 },
      { id: 'sk_lovable', name: 'Lovable', icon: 'fas fa-magic', order: 5 },
      { id: 'sk_more_ai', name: 'More AI Tools', icon: 'fas fa-plus-circle', order: 6 },
    ],
  },
  {
    id: 'cat_dev_tools',
    name: 'Developer Tools',
    icon: 'fas fa-tools',
    order: 5,
    status: 'published',
    skills: [
      { id: 'sk_git', name: 'Git', icon: 'fab fa-git-alt', order: 1 },
      { id: 'sk_github', name: 'GitHub', icon: 'fab fa-github', order: 2 },
      { id: 'sk_vscode', name: 'VS Code', icon: 'fas fa-code', order: 3 },
      { id: 'sk_xampp', name: 'XAMPP', icon: 'fas fa-server', order: 4 },
      { id: 'sk_idle', name: 'IDLE', icon: 'fas fa-terminal', order: 5 },
      { id: 'sk_mysql_workbench', name: 'MySQL Workbench', icon: 'fas fa-database', order: 6 },
    ],
  },
  {
    id: 'cat_ai_tech',
    name: 'AI Technologies',
    icon: 'fas fa-microchip',
    order: 6,
    status: 'published',
    skills: [
      { id: 'sk_ocr', name: 'OCR', icon: 'fas fa-eye', order: 1 },
      { id: 'sk_cv', name: 'Computer Vision', icon: 'fas fa-camera', order: 2 },
      { id: 'sk_tensorflow', name: 'TensorFlow', icon: 'fas fa-brain', order: 3 },
      { id: 'sk_agents', name: 'Agentic Agents', icon: 'fas fa-robot', order: 4 },
      { id: 'sk_ollama', name: 'Ollama', icon: 'fas fa-microchip', order: 5 },
    ],
  },
  {
    id: 'cat_databases',
    name: 'Databases',
    icon: 'fas fa-database',
    order: 7,
    status: 'published',
    skills: [
      { id: 'sk_mongo', name: 'MongoDB', icon: 'fas fa-database mongodb-icon', order: 1 },
      { id: 'sk_mysql', name: 'MySQL', icon: 'fas fa-database mysql-icon', order: 2 },
    ],
  },
  {
    id: 'cat_prof_skills',
    name: 'Professional Skills',
    icon: 'fas fa-users',
    order: 8,
    status: 'published',
    skills: [
      { id: 'sk_prob_solving', name: 'Problem Solving', icon: 'fas fa-lightbulb', order: 1 },
      { id: 'sk_decision', name: 'Decision Making', icon: 'fas fa-balance-scale', order: 2 },
      { id: 'sk_time_mgmt', name: 'Time Management', icon: 'fas fa-clock', order: 3 },
      { id: 'sk_adapt', name: 'Adaptability', icon: 'fas fa-sync-alt', order: 4 },
      { id: 'sk_event_mgmt', name: 'Event Management', icon: 'fas fa-calendar-check', order: 5 },
      { id: 'sk_teamwork', name: 'Teamwork', icon: 'fas fa-users', order: 6 },
      { id: 'sk_learner', name: 'Quick Learner', icon: 'fas fa-user-check', order: 7 },
    ],
  },
  {
    id: 'cat_languages',
    name: 'Languages',
    icon: 'fas fa-language',
    order: 9,
    status: 'published',
    skills: [
      { id: 'sk_lang_en', name: 'English', icon: 'fas fa-language', order: 1 },
      { id: 'sk_lang_kn', name: 'Kannada', icon: 'fas fa-language', order: 2 },
      { id: 'sk_lang_hi', name: 'Hindi', icon: 'fas fa-language', order: 3 },
    ],
  },
];

export const DEFAULT_SOCIAL_LINKS: SocialLinkItem[] = [
  {
    id: 'social_location',
    platform: 'Location',
    url: 'https://www.google.com/maps/search/?api=1&query=Honnali+Davanagere+Karnataka+India',
    icon: 'location-outline',
    title: 'Honnali, Davanagere, Karnataka, India',
    order: 1,
    isActive: true,
  },
  {
    id: 'social_email',
    platform: 'Email',
    url: 'https://mail.google.com/mail/?view=cm&fs=1&to=mayurhr57@gmail.com',
    icon: 'mail-outline',
    title: 'Email (mayurhr57@gmail.com)',
    order: 2,
    isActive: true,
  },
  {
    id: 'social_linkedin',
    platform: 'LinkedIn',
    url: 'https://www.linkedin.com/in/mayur-hr-2507962ba?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    icon: 'logo-linkedin',
    title: 'LinkedIn Profile',
    order: 3,
    isActive: true,
  },
  {
    id: 'social_github',
    platform: 'GitHub',
    url: 'https://github.com/Mayurhr',
    icon: 'logo-github',
    title: 'GitHub Profile',
    order: 4,
    isActive: true,
  },
  {
    id: 'social_leetcode',
    platform: 'LeetCode',
    url: 'https://leetcode.com/u/qE84fwcT6p/',
    icon: 'leetcode',
    title: 'LeetCode Profile',
    order: 5,
    isActive: true,
  },
  {
    id: 'social_whatsapp',
    platform: 'WhatsApp',
    url: 'https://wa.me/919663124725',
    icon: 'call-outline',
    title: '+91 9663124725',
    order: 6,
    isActive: true,
  },
  {
    id: 'social_instagram',
    platform: 'Instagram',
    url: 'https://www.instagram.com/mayur___.hr',
    icon: 'logo-instagram',
    title: 'Instagram Profile',
    order: 7,
    isActive: true,
  },
];
