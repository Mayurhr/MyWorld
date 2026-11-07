import type { Project } from '../types.ts';

export const projects: Project[] = [
  {
    title: 'Smart AI Travel Planner',
    description:
      'An AI-powered travel planning platform that helps users plan and manage complete trips through intelligent itinerary generation, travel recommendations, budget management, and an AI travel assistant. It combines AI agent orchestration with travel-related services to create a comprehensive travel-planning experience.',
    cardDescription:
      'An AI-powered travel planning platform that creates personalized itineraries, helps explore destinations and simplifies trip planning.',
    image: '/assest/projects/smart_ai_travel_planner.jpg',
    category: 'ai',
    cardTech: ['React', 'TypeScript', 'Node.js', 'Gemini AI'],
    tech: [
      'React 19',
      'TypeScript',
      'Vite',
      'Tailwind CSS 4',
      'Node.js',
      'Express.js',
      'Google Gemini API',
      'Three.js',
      'Motion',
      'Leaflet',
      'Google Maps',
      'OpenStreetMap',
      'Unsplash API',
      'jsPDF',
    ],
    features: [
      'Intelligent multi-day itinerary generation powered by Google Gemini API agent orchestration',
      'Interactive destination discovery and route mapping via Google Maps, Leaflet, and OpenStreetMap',
      'Built-in trip budget management, recommendations, and an interactive AI travel assistant',
      'One-click PDF itinerary export via jsPDF with responsive 3D/motion UI',
    ],
    github: 'https://github.com/Mayurhr/Smart-AI-Travel-Planner.git',
    demo: 'https://smart-ai-travel-planner.ai.studio/',
  },
  {
    title: 'Fitness Tracker',
    description:
      'A comprehensive fitness tracking application that helps users monitor workouts, nutrition, and progress.',
    image:
      'https://www.shutterstock.com/image-photo/hologram-athlete-running-wellness-exercise-600nw-2240460425.jpg',
    category: 'web',
    tech: ['HTML', 'CSS', 'JavaScript', 'node.js'],
    github: 'https://github.com/bharath2957s/Advance-fitness-tracker',
  },
  {
    title: 'Blood Management System',
    description:
      'A web-based system for managing blood donations, inventory, and requests between donors and recipients.',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRpKEbyPEs9DohxB2a363p1HkF_-g-p-Fs0fA&s',
    category: 'web',
    tech: ['HTML', 'CSS', 'JavaScript', 'Python'],
    github: 'https://github.com/Mayurhr/blood_management_system',
  },
  {
    title: 'Digital Vision Companion',
    description:
      'An AI-powered assistive vision system that uses real-time object detection, OCR and voice feedback to help visually impaired users navigate and read text.',
    image: 'https://www.orcam.com/media/AI_Assistive_Technology_for_low_vision.webp',
    category: 'web',
    tech: ['HTML', 'CSS', 'JavaScript', 'TensorFlow.js', 'COCO-SSD', 'Tesseract.js'],
    github: 'https://github.com/bharath2957s/Digital-Vision-Companion.git',
    demo: 'https://digital-vision-companion.web.app/',
  },
  {
    title: 'MedScript AI',
    description:
      'An AI-powered prescription validator that scans medical prescriptions and generates intelligent medication analysis.',
    image:
      'https://cdn.analyticsvidhya.com/wp-content/uploads/2025/03/Building-a-Medical-Prescription-Scanner-using-PaliGemma-2-Mix-.webp',
    category: 'ai',
    tech: ['React', 'TypeScript', 'Tailwind CSS', 'Gemini AI', 'OCR'],
    github: 'https://github.com/mazino2957s/Medscript-ai.git',
  },
  {
    title: 'Customer Review Intelligence System',
    description:
      'An Agentic AI platform that transforms customer reviews into actionable insights using a multi-agent pipeline for sentiment analysis, trend detection, and business recommendations.',
    image:
      'https://thumbs.dreamstime.com/b/ai-technology-power-artificial-intelligence-using-inputting-instructions-to-create-things-future-change-human-show-generated-368858854.jpg',
    category: 'ai',
    tech: ['React', 'Python', 'LangGraph', 'Ollama', 'LLaMA 3.1', 'Docker', 'AI Agents'],
    github:
      'https://github.com/mazino2957s/Agentic-AI-A-Multi-Agent-Customer-Review-Intelligence-System.git',
    videoDemo: 'assest/videos/demo.mp4',
  },
  {
    title: 'VaultX',
    description:
      'A secure trust file-sharing platform that provides encrypted, controlled and expiring file sharing with download limits, password protection, access auditing and instant link revocation.',
    image:
      'https://s3.us-east-1.amazonaws.com/files.tvisha.aws/posts/crm/panel/attachments/1784524543/secure-file-sharing-tools.jpeg',
    category: 'web',
    tech: [
      'React',
      'Vite',
      'TypeScript',
      'Node.js',
      'Express.js',
      'FastAPI',
      'PostgreSQL',
      'AES-256-GCM',
      'Tailwind CSS',
    ],
    github: 'https://github.com/bharath2957s/VaultX',
  },
  {
    title: 'Service Hub',
    description:
      'A modern platform that connects customers with trusted service providers through seamless booking, authentication and service management.',
    image:
      'https://imageio.forbes.com/specials-images/imageserve/66f4fc138d5d16f6f876f5f9/0x0.jpg?format=jpg&height=900&width=1600&fit=bounds',
    category: 'web',
    tech: ['React', 'Node.js', 'Express.js', 'MongoDB'],
    github: 'https://github.com/Mayurhr/serviceHub.git',
  },
];
