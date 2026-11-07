/**
 * Real event-based client analytics service.
 * Respects user privacy, generates anonymous visitor and session identifiers,
 * tracks real active engagement time, and transmits securely to the backend.
 */

export type AnalyticsEventType =
  | 'session_start'
  | 'page_view'
  | 'section_view'
  | 'engagement_heartbeat'
  | 'resume_view'
  | 'resume_download'
  | 'project_view'
  | 'project_link_click'
  | 'certificate_view'
  | 'social_click'
  | 'contact_submit_success'
  | 'contact_submit_error';

interface TrackEventOptions {
  targetId?: string;
  targetType?: string;
  engagementSeconds?: number;
  metadata?: Record<string, any>;
  isTest?: boolean;
}

const VISITOR_ID_KEY = 'mayur_portfolio_vid';
const SESSION_ID_KEY = 'mayur_portfolio_sid';
const SESSION_ACTIVITY_KEY = 'mayur_portfolio_last_act';
const SESSION_RECORDED_AT_KEY = 'mayur_session_start_recorded_at';
const ANALYTICS_RESET_KEY = 'mayur_analytics_reset_at';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout

/**
 * Resets local session tracking markers when analytics data is cleared from Admin.
 */
export function markAnalyticsResetLocally(): void {
  try {
    localStorage.setItem(ANALYTICS_RESET_KEY, String(Date.now()));
    sessionStorage.removeItem('mayur_session_start_recorded');
    sessionStorage.removeItem(SESSION_RECORDED_AT_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Returns or generates a persistent anonymous first-party visitor identifier.
 */
export function getAnonymousVisitorId(): string {
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid) {
      vid = `vid_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(VISITOR_ID_KEY, vid);
    }
    return vid;
  } catch {
    return 'anonymous_visitor';
  }
}

/**
 * Returns or generates an anonymous session identifier with a 30-minute timeout.
 */
export function getSessionId(): string {
  try {
    const now = Date.now();
    const lastActStr = sessionStorage.getItem(SESSION_ACTIVITY_KEY);
    const lastAct = lastActStr ? parseInt(lastActStr, 10) : 0;

    let sid = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid || !lastAct || now - lastAct > SESSION_TIMEOUT_MS) {
      sid = `sid_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem(SESSION_ID_KEY, sid);
    }

    sessionStorage.setItem(SESSION_ACTIVITY_KEY, now.toString());
    return sid;
  } catch {
    return 'transient_session';
  }
}

/**
 * Sanitizes referrer information to protect external user privacy.
 */
function getCleanReferrer(): string {
  try {
    const ref = document.referrer;
    if (!ref) return 'direct';
    const url = new URL(ref);
    if (url.origin === window.location.origin) {
      return 'internal';
    }
    return url.hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Sends a real tracking event to the server.
 */
export async function trackEvent(
  eventType: AnalyticsEventType,
  options: TrackEventOptions = {}
): Promise<void> {
  try {
    const visitorId = getAnonymousVisitorId();
    const sessionId = getSessionId();
    const referrer = getCleanReferrer();

    const payload = {
      eventType,
      visitorId,
      sessionId,
      targetId: options.targetId ? String(options.targetId).substring(0, 200) : undefined,
      targetType: options.targetType ? String(options.targetType).substring(0, 100) : undefined,
      engagementSeconds: typeof options.engagementSeconds === 'number' ? Math.round(options.engagementSeconds) : undefined,
      referrer,
      metadata: options.metadata || {},
      isTest: options.isTest === true,
    };

    const payloadString = JSON.stringify(payload);

    // If Beacon API is available and payload is small, prefer Beacon for unload reliability
    if (navigator.sendBeacon && (eventType === 'engagement_heartbeat' || eventType === 'session_start')) {
      const blob = new Blob([payloadString], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/track', blob);
      return;
    }

    // Standard fetch
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payloadString,
      keepalive: true,
    });
  } catch (err) {
    // Analytics failures must never break UI execution
    console.debug('[Analytics] Event tracking dropped silently:', err);
  }
}

// Active engagement state
let activeEngagementSeconds = 0;
let lastActiveTimestamp: number = Date.now();
let isUserEngaged = true;
let idleTimer: any = null;
let heartbeatInterval: any = null;

function handleUserActivity() {
  lastActiveTimestamp = Date.now();
  isUserEngaged = true;

  clearTimeout(idleTimer);
  // Mark user as idle after 15 seconds of zero interaction
  idleTimer = setTimeout(() => {
    isUserEngaged = false;
  }, 15000);
}

/**
 * Initializes active engagement tracking and session lifecycles.
 */
export function initEngagementTracker(): () => void {
  // Prevent duplicate initializations
  if (typeof window === 'undefined') return () => {};

  const resetAt = Number(localStorage.getItem(ANALYTICS_RESET_KEY) || 0);
  const recordedAt = Number(sessionStorage.getItem(SESSION_RECORDED_AT_KEY) || 0);
  const sessionRecorded = sessionStorage.getItem('mayur_session_start_recorded');

  if (!sessionRecorded || recordedAt < resetAt) {
    if (recordedAt < resetAt) {
      sessionStorage.removeItem(SESSION_ID_KEY);
      sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
    }
    trackEvent('session_start');
    trackEvent('page_view', { targetId: window.location.pathname || '/' });
    sessionStorage.setItem('mayur_session_start_recorded', 'true');
    sessionStorage.setItem(SESSION_RECORDED_AT_KEY, String(Date.now()));
  } else {
    trackEvent('page_view', { targetId: window.location.pathname || '/' });
  }

  // Activity listeners
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
  activityEvents.forEach((ev) => {
    window.addEventListener(ev, handleUserActivity, { passive: true });
  });

  // Track active time every second if tab is visible and user is actively interacting
  const secondTicker = setInterval(() => {
    if (document.visibilityState === 'visible' && isUserEngaged) {
      activeEngagementSeconds += 1;
    }
  }, 1000);

  // Send periodic heartbeat every 30 seconds of active engagement
  heartbeatInterval = setInterval(() => {
    if (activeEngagementSeconds >= 10) {
      trackEvent('engagement_heartbeat', {
        engagementSeconds: activeEngagementSeconds,
      });
      activeEngagementSeconds = 0;
    }
  }, 30000);

  // Flush on tab hide or unload
  const flushEngagement = () => {
    if (activeEngagementSeconds > 0) {
      trackEvent('engagement_heartbeat', {
        engagementSeconds: activeEngagementSeconds,
      });
      activeEngagementSeconds = 0;
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushEngagement();
    }
  });

  window.addEventListener('beforeunload', flushEngagement);

  return () => {
    flushEngagement();
    clearInterval(secondTicker);
    clearInterval(heartbeatInterval);
    clearTimeout(idleTimer);
    activityEvents.forEach((ev) => {
      window.removeEventListener(ev, handleUserActivity);
    });
  };
}

/**
 * Domain-specific tracking helper methods
 */
export const analytics = {
  trackPageView: (page: string) =>
    trackEvent('page_view', { targetId: page, targetType: 'page' }),

  trackSectionView: (sectionId: string) =>
    trackEvent('section_view', { targetId: sectionId, targetType: 'section' }),

  trackResumeView: () =>
    trackEvent('resume_view', { targetId: 'resume_pdf', targetType: 'resume' }),

  trackResumeDownload: () =>
    trackEvent('resume_download', { targetId: 'resume_pdf', targetType: 'resume' }),

  trackProjectInteraction: (projectTitle: string, action: 'view' | 'github' | 'live' | 'video') =>
    trackEvent(action === 'github' || action === 'live' ? 'project_link_click' : 'project_view', {
      targetId: projectTitle,
      targetType: 'project',
      metadata: { action },
    }),

  trackCertificateInteraction: (certTitle: string, action: 'view_modal' | 'view_image' | 'view_pdf') =>
    trackEvent('certificate_view', {
      targetId: certTitle,
      targetType: 'certificate',
      metadata: { action },
    }),

  trackSocialClick: (platform: string, url: string) =>
    trackEvent('social_click', {
      targetId: platform,
      targetType: 'social',
      metadata: { url },
    }),

  trackContactSubmit: (status: 'success' | 'error', subject?: string) =>
    trackEvent(status === 'success' ? 'contact_submit_success' : 'contact_submit_error', {
      targetId: subject || 'General Inquiry',
      targetType: 'contact',
    }),
};
