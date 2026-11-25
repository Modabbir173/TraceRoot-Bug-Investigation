import { useEffect, useState, type ReactNode } from 'react';
import { useGetDashboardSummary, useListActivity, useListIssues } from '@workspace/api-client-react';
import { Activity, ArrowRight, CircleAlert, Clock3, FileText, Layers3, Radio, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import { EmptyState, ErrorState, LoadingRows, PageHeading } from '@/components/app-shell';
import { IssueRow } from '@/components/issue-visuals';
import { errorMessage, humanize, relativeTime } from '@/lib/format';

interface ReportSummary {
  id: string;
  issue_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const summary = useGetDashboardSummary();
  const issueList = useListIssues();
  const activity = useListActivity({ limit: 8 });
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const stats = summary.data;

  useEffect(() => {
    let active = true;
    async function loadReports() {
      setReportsLoading(true);
      setReportsError(null);
      try {
        const token = localStorage.getItem('traceroot_access_token');
        if (!token) throw new Error('Your session has expired. Please sign in again.');
        const response = await fetch('/api/reports', { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail || 'Unable to load investigation reports.');
        if (!Array.isArray(payload)) throw new Error('The reports response was not in the expected format.');
        if (active) setReports(payload as ReportSummary[]);
      } catch (error) {
        if (active) setReportsError(error instanceof Error ? error.message : 'Unable to load investigation reports.');
      } finally {
        if (active) setReportsLoading(false);
      }
    }
    void loadReports();
    return () => { active = false; };
  }, []);

  return (
    <div className="content">
      <PageHeading title="Investigation desk" subtitle="A clear view of what is breaking, who is on it, and what changed."
        action={<Link href="/issues" className="button-primary" data-testid="button-open-issues">Browse issues <ArrowRight size={15} /></Link>} />
      {summary.isError && <div className="error-note" style={{ margin: '20px 0' }} data-testid="status-summary-error">
        {errorMessage(summary.error)} <button className="button-quiet" onClick={() => summary.refetch()}>Retry</button>
      </div>}
      <section className="metric-grid" aria-label="Investigation summary">
        <Metric label="All issues" value={stats?.total} icon={<Layers3 size={15} />} loading={summary.isLoading} />
        <Metric label="Open" value={stats?.open} icon={<CircleAlert size={15} />} tone="open" loading={summary.isLoading} />
        <Metric label="Investigating" value={stats?.investigating} icon={<Radio size={15} />} loading={summary.isLoading} />
        <Metric label="Resolved" value={stats?.resolved} icon={<ShieldCheck size={15} />} loading={summary.isLoading} />
        <Metric label="Critical" value={stats?.critical} icon={<CircleAlert size={15} />} tone="critical" loading={summary.isLoading} />
        <Metric label="Reports" value={reports.length} icon={<FileText size={15} />} loading={reportsLoading} />
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-head"><div><h2 className="panel-title">Active investigations</h2><div className="panel-kicker" style={{ marginTop: 4 }}>Issues needing a closer look</div></div>
            <Link href="/issues" className="button-quiet" data-testid="link-all-issues">All issues <ArrowRight size={14} /></Link></div>
          {issueList.isLoading ? <LoadingRows /> : issueList.isError ? <ErrorState message={errorMessage(issueList.error)} onRetry={() => issueList.refetch()} /> :
            issueList.data?.filter((issue) => issue.status !== 'resolved').slice(0, 6).length ?
              <div className="issue-list">{issueList.data.filter((issue) => issue.status !== 'resolved').slice(0, 6).map((issue) => <IssueRow key={issue.id} issue={issue} />)}</div> :
              <EmptyState title="No active investigations" detail="When a failure is reported, it will appear here." />}
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2 className="panel-title">Recent activity</h2><div className="panel-kicker" style={{ marginTop: 4 }}>Investigation trail</div></div><Clock3 size={16} color="#8a969a" /></div>
          {activity.isLoading ? <LoadingRows count={5} /> : activity.isError ? <ErrorState message={errorMessage(activity.error)} onRetry={() => activity.refetch()} /> :
            activity.data?.length ? <div className="activity-list">{activity.data.map((item) => <Link href={`/issues/${encodeURIComponent(item.issue_id)}`} className="activity-item" key={item.id} data-testid={`activity-item-${item.id}`} style={{ textDecoration: 'none' }}>
              <span className="activity-mark"><Activity size={13} /></span>
              <span className="activity-copy"><strong>{item.actor}</strong> {humanize(item.action)} <strong>{item.issue_title}</strong><span style={{ display: 'block', color: '#98a0a4', marginTop: 2 }}>{relativeTime(item.created_at)}</span></span>
            </Link>)}</div> : <EmptyState title="No activity yet" detail="Updates to issues will create a trace here." />}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head"><div><h2 className="panel-title">Recent investigation reports</h2><div className="panel-kicker" style={{ marginTop: 4 }}>Generated findings and saved investigation records</div></div><FileText size={16} color="#8a969a" /></div>
        {reportsLoading ? <LoadingRows count={3} /> : reportsError ?
          <div className="error-note" data-testid="status-reports-error">{reportsError} <button className="button-quiet" onClick={() => window.location.reload()}>Retry</button></div> :
          reports.length ? <div className="activity-list">{reports.slice(0, 5).map((report) => <Link href={`/issues/${encodeURIComponent(report.issue_id)}`} className="activity-item" key={report.id} data-testid={`report-item-${report.id}`} style={{ textDecoration: 'none' }}>
            <span className="activity-mark"><FileText size={13} /></span>
            <span className="activity-copy"><strong>{report.title}</strong><span style={{ display: 'block', color: '#98a0a4', marginTop: 3 }}>Issue {report.issue_id} · {relativeTime(report.created_at)}</span></span>
            <ArrowRight size={14} />
          </Link>)}</div> :
          <EmptyState title="No investigation reports yet" detail="Generate a report from an issue after reviewing its evidence and analysis." />}
      </section>
    </div>
  );
}

function Metric({ label, value, icon, tone = '', loading }: { label: string; value?: number; icon: ReactNode; tone?: string; loading: boolean }) {
  return <div className={`metric ${tone}`} data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#89949a' }}><span className="metric-label">{label}</span>{icon}</div>
    <div className="metric-number">{loading ? <span style={{ color: '#c4ccc7' }}>···</span> : value ?? '—'}</div>
  </div>;
}
