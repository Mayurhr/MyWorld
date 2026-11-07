import type { AnalyticsEvent, PortfolioStore } from './storage.ts';

export interface AnalyticsOverviewMetrics {
  totalVisits: number;
  uniqueVisitors: number;
  dailyVisitors: number;
  weeklyVisitors: number;
  monthlyVisitors: number;
  pageViews: number;
  totalEngagementSeconds: number;
  avgEngagementSeconds: number;
  resumeInteractions: number;
  projectInteractions: number;
  contactSubmissions: number;
  sectionViews: { section: string; count: number }[];
  popularProjects: { title: string; count: number }[];
  socialClicks: { platform: string; count: number }[];
  deviceBreakdown: { desktop: number; tablet: number; mobile: number };
  topReferrers: { source: string; count: number }[];
  dailyTimeline: {
    date: string;
    visits: number;
    pageViews: number;
    engagementMinutes: number;
  }[];
  totalEventsInRange: number;
  rangeDescription: string;
}

/**
 * Filters analytics events according to the selected date range and test filters.
 */
export function filterEventsByDateRange(
  events: AnalyticsEvent[],
  range: string = '7d',
  customStart?: string,
  customEnd?: string,
  includeTest: boolean = false
): { filtered: AnalyticsEvent[]; rangeDesc: string } {
  const now = new Date();
  let startTime = 0;
  let endTime = now.getTime();
  let rangeDesc = 'Last 7 Days';

  switch (range) {
    case 'today': {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startTime = startOfDay.getTime();
      rangeDesc = 'Today';
      break;
    }
    case '7d': {
      startTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      rangeDesc = 'Last 7 Days';
      break;
    }
    case '30d': {
      startTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      rangeDesc = 'Last 30 Days';
      break;
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startTime = startOfMonth.getTime();
      rangeDesc = 'This Month';
      break;
    }
    case 'custom': {
      if (customStart) {
        startTime = new Date(`${customStart}T00:00:00`).getTime();
      }
      if (customEnd) {
        endTime = new Date(`${customEnd}T23:59:59.999`).getTime();
      }
      rangeDesc = `Custom (${customStart || 'start'} to ${customEnd || 'now'})`;
      break;
    }
    case 'all':
    default: {
      startTime = 0;
      rangeDesc = 'All Time';
      break;
    }
  }

  const filtered = events.filter((ev) => {
    // Filter test events unless explicitly included
    if (!includeTest && ev.isTest === true) {
      return false;
    }

    const evTime = new Date(ev.timestamp).getTime();
    if (isNaN(evTime)) return false;

    return evTime >= startTime && evTime <= endTime;
  });

  return { filtered, rangeDesc };
}

/**
 * Computes verifiable analytics summaries from raw event records.
 * Zero mocked data or hardcoded values.
 */
export function calculateAnalyticsMetrics(
  events: AnalyticsEvent[],
  rangeDesc: string,
  allEligibleEvents?: AnalyticsEvent[]
): AnalyticsOverviewMetrics {
  const sessionSet = new Set<string>();
  const visitorSet = new Set<string>();
  let pageViews = 0;
  let totalEngagementSeconds = 0;
  let resumeInteractions = 0;
  let projectInteractions = 0;
  let contactSubmissions = 0;

  const sectionMap: Record<string, number> = {};
  const projectMap: Record<string, number> = {};
  const socialMap: Record<string, number> = {};
  const referrerMap: Record<string, number> = {};
  const deviceCounts = { desktop: 0, tablet: 0, mobile: 0 };

  // Daily map: 'YYYY-MM-DD' -> { visits: Set<string>, pageViews: number, engagementSeconds: number }
  const dailyMap: Record<
    string,
    { sessions: Set<string>; pageViews: number; engagementSeconds: number }
  > = {};

  for (const ev of events) {
    if (ev.sessionId) sessionSet.add(ev.sessionId);
    if (ev.visitorId) visitorSet.add(ev.visitorId);

    // Device category
    const dev = ev.deviceCategory || 'desktop';
    if (dev in deviceCounts) {
      deviceCounts[dev] += 1;
    } else {
      deviceCounts.desktop += 1;
    }

    // Daily bucket
    const dateKey = ev.timestamp.split('T')[0] || 'Unknown';
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { sessions: new Set(), pageViews: 0, engagementSeconds: 0 };
    }
    if (ev.sessionId) {
      dailyMap[dateKey].sessions.add(ev.sessionId);
    }

    // Engagement
    if (typeof ev.engagementSeconds === 'number' && ev.engagementSeconds > 0) {
      totalEngagementSeconds += ev.engagementSeconds;
      dailyMap[dateKey].engagementSeconds += ev.engagementSeconds;
    }

    // Referrer
    if (ev.referrer && ev.referrer !== 'internal') {
      const refClean = ev.referrer.replace(/^https?:\/\//i, '').split('/')[0];
      referrerMap[refClean] = (referrerMap[refClean] || 0) + 1;
    }

    // Specific event metrics
    switch (ev.eventType) {
      case 'page_view':
        pageViews += 1;
        dailyMap[dateKey].pageViews += 1;
        break;

      case 'section_view': {
        const sec = ev.targetId || 'unknown';
        sectionMap[sec] = (sectionMap[sec] || 0) + 1;
        break;
      }

      case 'resume_view':
      case 'resume_download':
        resumeInteractions += 1;
        break;

      case 'project_view':
      case 'project_link_click': {
        projectInteractions += 1;
        const pTitle = ev.targetId || 'Untitled Project';
        projectMap[pTitle] = (projectMap[pTitle] || 0) + 1;
        break;
      }

      case 'social_click': {
        const plat = ev.targetId || 'Social Channel';
        socialMap[plat] = (socialMap[plat] || 0) + 1;
        break;
      }

      case 'contact_submit_success':
        contactSubmissions += 1;
        break;

      default:
        break;
    }
  }

  // Compute daily (24h), weekly (7d), and monthly (30d) distinct visitors from eligible events
  const nowMs = Date.now();
  const dayStartMs = nowMs - 24 * 60 * 60 * 1000;
  const weekStartMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const monthStartMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  const dailyVisitorSet = new Set<string>();
  const weeklyVisitorSet = new Set<string>();
  const monthlyVisitorSet = new Set<string>();

  for (const ev of allEligibleEvents || events) {
    if (!ev.visitorId) continue;
    const evMs = new Date(ev.timestamp).getTime();
    if (isNaN(evMs)) continue;
    if (evMs >= dayStartMs) dailyVisitorSet.add(ev.visitorId);
    if (evMs >= weekStartMs) weeklyVisitorSet.add(ev.visitorId);
    if (evMs >= monthStartMs) monthlyVisitorSet.add(ev.visitorId);
  }

  const totalVisits = sessionSet.size;
  const uniqueVisitors = visitorSet.size;
  const avgEngagementSeconds =
    totalVisits > 0 ? Math.round(totalEngagementSeconds / totalVisits) : 0;

  // Format section views sorted desc
  const sectionViews = Object.entries(sectionMap)
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count);

  // Format popular projects sorted desc
  const popularProjects = Object.entries(projectMap)
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);

  // Format social clicks sorted desc
  const socialClicks = Object.entries(socialMap)
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  // Format referrers sorted desc
  const topReferrers = Object.entries(referrerMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Format timeline sorted chronologically
  const dailyTimeline = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({
      date,
      visits: d.sessions.size,
      pageViews: d.pageViews,
      engagementMinutes: Math.round((d.engagementSeconds / 60) * 10) / 10,
    }));

  return {
    totalVisits,
    uniqueVisitors,
    dailyVisitors: dailyVisitorSet.size,
    weeklyVisitors: weeklyVisitorSet.size,
    monthlyVisitors: monthlyVisitorSet.size,
    pageViews,
    totalEngagementSeconds,
    avgEngagementSeconds,
    resumeInteractions,
    projectInteractions,
    contactSubmissions,
    sectionViews,
    popularProjects,
    socialClicks,
    deviceBreakdown: deviceCounts,
    topReferrers,
    dailyTimeline,
    totalEventsInRange: events.length,
    rangeDescription: rangeDesc,
  };
}
