import React, { useState, useEffect } from 'react';
import { AnalyticsOverviewMetrics } from '../../server/analyticsService';
import { markAnalyticsResetLocally } from '../../services/analytics';

interface RawAnalyticsEvent {
  id: string;
  eventType: string;
  visitorId: string;
  sessionId: string;
  timestamp: string;
  targetId?: string;
  targetType?: string;
  deviceCategory: string;
  referrer?: string;
  engagementSeconds?: number;
  isTest?: boolean;
}

export const AdminAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalyticsOverviewMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<RawAnalyticsEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedRange, setSelectedRange] = useState<string>('7d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [includeTest, setIncludeTest] = useState<boolean>(false);

  // Verification & Testing Actions
  const [isTriggeringTest, setIsTriggeringTest] = useState<boolean>(false);
  const [isClearingTest, setIsClearingTest] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isResettingAnalytics, setIsResettingAnalytics] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = sessionStorage.getItem('admin_session_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        range: selectedRange,
        includeTest: includeTest ? 'true' : 'false',
      });

      if (selectedRange === 'custom') {
        if (customStart) params.append('startDate', customStart);
        if (customEnd) params.append('endDate', customEnd);
      }

      const [overviewRes, eventsRes] = await Promise.all([
        fetch(`/api/admin/analytics/overview?${params.toString()}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
        fetch(`/api/admin/analytics/events?limit=40&includeTest=${includeTest ? 'true' : 'false'}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
      ]);

      if (!overviewRes.ok) {
        throw new Error(`Overview request failed (${overviewRes.status})`);
      }
      if (!eventsRes.ok) {
        throw new Error(`Events request failed (${eventsRes.status})`);
      }

      const overviewData = await overviewRes.json();
      const eventsData = await eventsRes.json();

      setMetrics(overviewData.metrics);
      setRecentEvents(eventsData);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to fetch analytics metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedRange, customStart, customEnd, includeTest]);

  const handleTriggerTestEvent = async (type: string = 'page_view') => {
    try {
      setIsTriggeringTest(true);
      setActionNotice(null);

      const res = await fetch('/api/admin/analytics/test-event', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          eventType: type,
          targetId: 'admin_verification_checkpoint',
          targetType: 'test_audit',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger test event');

      setActionNotice(`✓ Test event [${data.event.id}] created! Toggle "Include Test Events" below to inspect.`);
      await loadAnalytics();
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setIsTriggeringTest(false);
    }
  };

  const handleClearTestData = async () => {
    if (!window.confirm('Clear all marked test events from the database? Production analytics will remain untouched.')) {
      return;
    }

    try {
      setIsClearingTest(true);
      setActionNotice(null);

      const res = await fetch('/api/admin/analytics/clear-test-data', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear test data');

      setActionNotice(`✓ ${data.message}`);
      await loadAnalytics();
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setIsClearingTest(false);
    }
  };

  const handleConfirmResetAnalytics = async () => {
    if (isResettingAnalytics) return;
    try {
      setIsResettingAnalytics(true);
      setActionNotice(null);

      const res = await fetch('/api/admin/analytics/reset', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset analytics.');
      }

      markAnalyticsResetLocally();
      setShowResetModal(false);
      setActionNotice(`✓ ${data.message}`);
      await loadAnalytics();
    } catch (err: any) {
      setShowResetModal(false);
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setIsResettingAnalytics(false);
    }
  };

  const formatEngagementTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Real-Time Portfolio Analytics
            </h1>
            <span
              style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                padding: '3px 8px',
                borderRadius: '6px',
                fontWeight: 600,
              }}
            >
              ● LIVE TRACKING
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', color: '#a1a1aa', fontSize: '0.88rem' }}>
            Verifiable, database-backed tracking of visitors, active engagement time, section visibility, and interactions.
          </p>
        </div>

        {/* Verification Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleTriggerTestEvent('page_view')}
            disabled={isTriggeringTest}
            title="Send a sample test event to verify tracking"
            style={{
              padding: '8px 14px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '8px',
              color: '#c7d2fe',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: isTriggeringTest ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className={isTriggeringTest ? 'fas fa-spinner fa-spin' : 'fas fa-vial'}></i>
            <span>Send Test Event</span>
          </button>

          <button
            type="button"
            onClick={handleClearTestData}
            disabled={isClearingTest}
            title="Clean marked test data from database"
            style={{
              padding: '8px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: isClearingTest ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className={isClearingTest ? 'fas fa-spinner fa-spin' : 'fas fa-trash-alt'}></i>
            <span>Clean Test Events</span>
          </button>

          <button
            type="button"
            data-testid="reset-analytics-btn"
            onClick={() => setShowResetModal(true)}
            disabled={isResettingAnalytics}
            title="Reset all analytics metrics and event history to zero"
            style={{
              padding: '8px 14px',
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '8px',
              color: '#fecaca',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: isResettingAnalytics ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fas fa-redo-alt"></i>
            <span>Reset Analytics</span>
          </button>

          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            title="Refresh analytics data"
            style={{
              padding: '8px 12px',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#d4d4d8',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            <i className={loading ? 'fas fa-sync fa-spin' : 'fas fa-sync'}></i>
          </button>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '10px',
            backgroundColor: actionNotice.startsWith('✓') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionNotice.startsWith('✓') ? '#10b981' : '#ef4444'}`,
            color: actionNotice.startsWith('✓') ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Toolbar Card */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#71717a', marginRight: '4px', fontWeight: 600 }}>
            PERIOD:
          </span>

          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom Range' },
            { id: 'all', label: 'All Time' },
          ].map((pill) => {
            const isSelected = selectedRange === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedRange(pill.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid #3b82f6' : '1px solid #27272a',
                  backgroundColor: isSelected ? '#2563eb' : '#18181b',
                  color: isSelected ? '#ffffff' : '#a1a1aa',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Custom Range Inputs */}
        {selectedRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.82rem',
              }}
            />
            <span style={{ color: '#71717a' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.82rem',
              }}
            />
          </div>
        )}

        {/* Test Data Toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            color: '#a1a1aa',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => setIncludeTest(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: '#a855f7' }}
          />
          <span>Include Test Events in Metrics</span>
        </label>
      </div>

      {error && (
        <div
          style={{
            padding: '18px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            color: '#fca5a5',
            marginBottom: '24px',
          }}
        >
          <strong>Error loading analytics:</strong> {error}
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Total Visits (Sessions) */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Total Sessions / Visits</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-users"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.totalVisits : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Distinct visitor sessions</span>
        </div>

        {/* Unique Browsers */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Estimated Unique Visitors</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-fingerprint"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.uniqueVisitors : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Anonymous 1st-party identifiers</span>
        </div>

        {/* Daily Visitors (24h) */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Daily Visitors (24h)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-calendar-day"></i>
            </div>
          </div>
          <div data-testid="kpi-daily-visitors" style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.dailyVisitors : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Unique visitors in past 24 hours</span>
        </div>

        {/* Weekly Visitors (7d) */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Weekly Visitors (7d)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-calendar-week"></i>
            </div>
          </div>
          <div data-testid="kpi-weekly-visitors" style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.weeklyVisitors : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Unique visitors in past 7 days</span>
        </div>

        {/* Monthly Visitors (30d) */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Monthly Visitors (30d)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-calendar-alt"></i>
            </div>
          </div>
          <div data-testid="kpi-monthly-visitors" style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.monthlyVisitors : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Unique visitors in past 30 days</span>
        </div>

        {/* Page Views */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Page Views</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-eye"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.pageViews : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Total portfolio pages viewed</span>
        </div>

        {/* Active Engagement Time */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Avg Active Engagement</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-stopwatch"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? formatEngagementTime(metrics.avgEngagementSeconds) : '0s'}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#c084fc' }}>Active tab visible time</span>
        </div>

        {/* Project Interactions */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Project Interactions</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-laptop-code"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.projectInteractions : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Clicks, demos &amp; GitHub views</span>
        </div>

        {/* Resume Interactions */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Resume Downloads / Views</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-file-pdf"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.resumeInteractions : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>PDF modal opens &amp; downloads</span>
        </div>

        {/* Contact Submissions */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>Contact Submissions</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-paper-plane"></i>
            </div>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            {metrics ? metrics.contactSubmissions : 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Successfully submitted messages</span>
        </div>
      </div>

      {/* DAILY TIMELINE CHART */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff', fontWeight: 600 }}>
              Traffic &amp; Engagement Timeline
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#71717a' }}>
              Daily recorded sessions and page views for: {metrics?.rangeDescription || selectedRange}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }}></span>
              <span style={{ color: '#d4d4d8' }}>Visits</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#a855f7' }}></span>
              <span style={{ color: '#d4d4d8' }}>Page Views</span>
            </div>
          </div>
        </div>

        {/* Timeline Visualization */}
        {metrics && metrics.dailyTimeline.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '180px', paddingTop: '20px' }}>
            {metrics.dailyTimeline.map((day) => {
              const maxVal = Math.max(...metrics.dailyTimeline.map((d) => Math.max(d.visits, d.pageViews)), 1);
              const visitHeight = Math.max(8, (day.visits / maxVal) * 140);
              const pvHeight = Math.max(8, (day.pageViews / maxVal) * 140);

              return (
                <div
                  key={day.date}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', justifyContent: 'center' }}>
                    {/* Visits Bar */}
                    <div
                      title={`${day.date}: ${day.visits} visit(s)`}
                      style={{
                        width: '14px',
                        height: `${visitHeight}px`,
                        backgroundColor: '#3b82f6',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    {/* Page Views Bar */}
                    <div
                      title={`${day.date}: ${day.pageViews} page view(s)`}
                      style={{
                        width: '14px',
                        height: `${pvHeight}px`,
                        backgroundColor: '#a855f7',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#71717a', whiteSpace: 'nowrap' }}>
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#71717a',
              fontSize: '0.9rem',
              backgroundColor: '#18181b',
              borderRadius: '12px',
              border: '1px dashed #27272a',
            }}
          >
            <i className="fas fa-chart-line" style={{ fontSize: '28px', color: '#3f3f46', marginBottom: '10px', display: 'block' }}></i>
            No traffic recorded within the selected date window ({metrics?.rangeDescription || selectedRange}).
          </div>
        )}
      </div>

      {/* TWO COLUMN BREAKDOWN GRIDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          marginBottom: '28px',
        }}
      >
        {/* Popular Sections */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px',
          }}
        >
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: '#ffffff', fontWeight: 600 }}>
            Most Viewed Sections
          </h3>
          {metrics && metrics.sectionViews.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.sectionViews.map((sec, idx) => (
                <div
                  key={sec.section}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#18181b',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#71717a', fontSize: '0.75rem', fontWeight: 700 }}>#{idx + 1}</span>
                    <span style={{ color: '#ffffff', textTransform: 'capitalize' }}>{sec.section}</span>
                  </div>
                  <span style={{ color: '#60a5fa', fontWeight: 600 }}>{sec.count} view(s)</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
              No section views recorded in range.
            </div>
          )}
        </div>

        {/* Most Interacted Projects */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px',
          }}
        >
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: '#ffffff', fontWeight: 600 }}>
            Top Interacted Projects
          </h3>
          {metrics && metrics.popularProjects.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.popularProjects.map((proj, idx) => (
                <div
                  key={proj.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#18181b',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ color: '#71717a', fontSize: '0.75rem', fontWeight: 700 }}>#{idx + 1}</span>
                    <span style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {proj.title}
                    </span>
                  </div>
                  <span style={{ color: '#34d399', fontWeight: 600, flexShrink: 0 }}>{proj.count} interaction(s)</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
              No project interactions recorded in range.
            </div>
          )}
        </div>

        {/* Social Link Clicks */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px',
          }}
        >
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: '#ffffff', fontWeight: 600 }}>
            Social Profile Clicks
          </h3>
          {metrics && metrics.socialClicks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.socialClicks.map((soc) => (
                <div
                  key={soc.platform}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#18181b',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ color: '#ffffff' }}>{soc.platform}</span>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>{soc.count} click(s)</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
              No social clicks recorded in range.
            </div>
          )}
        </div>

        {/* Device & Referrers Breakdown */}
        <div
          style={{
            backgroundColor: '#121214',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '22px',
          }}
        >
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: '#ffffff', fontWeight: 600 }}>
            Device &amp; Traffic Channels
          </h3>

          {metrics && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Devices */}
              <div>
                <span style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Device Breakdown
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <i className="fas fa-desktop" style={{ color: '#3b82f6', marginBottom: '4px', display: 'block' }}></i>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'block' }}>
                      {metrics.deviceBreakdown.desktop}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#71717a' }}>Desktop</span>
                  </div>
                  <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <i className="fas fa-tablet-alt" style={{ color: '#a855f7', marginBottom: '4px', display: 'block' }}></i>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'block' }}>
                      {metrics.deviceBreakdown.tablet}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#71717a' }}>Tablet</span>
                  </div>
                  <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <i className="fas fa-mobile-alt" style={{ color: '#10b981', marginBottom: '4px', display: 'block' }}></i>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'block' }}>
                      {metrics.deviceBreakdown.mobile}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#71717a' }}>Mobile</span>
                  </div>
                </div>
              </div>

              {/* Top Referrers */}
              <div>
                <span style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Referrer Sources
                </span>
                {metrics.topReferrers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {metrics.topReferrers.slice(0, 3).map((r) => (
                      <div
                        key={r.source}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          backgroundColor: '#18181b',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                        }}
                      >
                        <span style={{ color: '#e4e4e7' }}>{r.source}</span>
                        <span style={{ color: '#93c5fd', fontWeight: 600 }}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: '#71717a' }}>Direct visits or privacy-shielded referrers</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RAW EVENTS AUDIT LOG TABLE */}
      <div
        style={{
          backgroundColor: '#121214',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff', fontWeight: 600 }}>
              Recent Raw Events Audit Log
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
              Inspect live incoming events with server-validated timestamps &amp; device metadata.
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
            Showing {recentEvents.length} recent record(s)
          </span>
        </div>

        {recentEvents.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a', color: '#71717a' }}>
                  <th style={{ padding: '10px 12px' }}>Event ID</th>
                  <th style={{ padding: '10px 12px' }}>Time (Server UTC)</th>
                  <th style={{ padding: '10px 12px' }}>Event Type</th>
                  <th style={{ padding: '10px 12px' }}>Target Item</th>
                  <th style={{ padding: '10px 12px' }}>Device</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      color: '#d4d4d8',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#93c5fd' }}>
                      {ev.id}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor:
                            ev.eventType.includes('submit')
                              ? 'rgba(16, 185, 129, 0.15)'
                              : ev.eventType.includes('click')
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(255, 255, 255, 0.06)',
                          color:
                            ev.eventType.includes('submit')
                              ? '#34d399'
                              : ev.eventType.includes('click')
                              ? '#60a5fa'
                              : '#e4e4e7',
                        }}
                      >
                        {ev.eventType}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.targetId || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>
                      {ev.deviceCategory}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {ev.isTest ? (
                        <span style={{ fontSize: '0.7rem', color: '#c084fc', backgroundColor: 'rgba(168, 85, 247, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                          TEST
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                          PROD
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
            No recent events in database. Click &quot;Send Test Event&quot; above to create and verify a live test event.
          </div>
        )}
      </div>

      {/* Explicit Confirmation Modal for Reset Analytics */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-analytics-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 120,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#121214',
              border: '1px solid #27272a',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.16)',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3
                id="reset-analytics-dialog-title"
                style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}
              >
                Reset Analytics Data?
              </h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#a1a1aa', lineHeight: 1.6 }}>
              This will permanently clear all recorded analytics metrics, visitor history, page views, engagement time, and raw event logs back to <strong style={{ color: '#ffffff' }}>0</strong>. Your portfolio projects, certificates, qualifications, skills, profile, resume, and visitor messages will remain completely intact.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResettingAnalytics}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#d4d4d8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-reset-analytics-btn"
                onClick={handleConfirmResetAnalytics}
                disabled={isResettingAnalytics}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: isResettingAnalytics ? 'not-allowed' : 'pointer',
                }}
              >
                {isResettingAnalytics ? 'Resetting...' : 'Confirm Reset Analytics'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
