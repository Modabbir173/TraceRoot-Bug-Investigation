import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Activity, ArrowUpRight, Bug, CircleDot, Command, LayoutDashboard, ListFilter, Search } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getHealthCheckQueryKey, useHealthCheck } from '@workspace/api-client-react';

type NoticeContextValue = (message: string) => void;
const NoticeContext = createContext<NoticeContextValue>(() => undefined);

export function useNotice() {
  return useContext(NoticeContext);
}

function NavigationLinks() {
  const [location] = useLocation();
  return (
    <>
      <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-dashboard">
        <LayoutDashboard size={17} /> Overview
      </Link>
      <Link href="/issues" className={`nav-link ${location.startsWith('/issues') ? 'active' : ''}`} data-testid="link-issues">
        <Bug size={17} /> Issues
      </Link>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 30_000 } });
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <NoticeContext.Provider value={setNotice}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand" data-testid="link-brand">
            <span className="brand-mark"><Command size={18} strokeWidth={2.5} /></span>
            <span className="brand-name">trace<span>root</span></span>
          </Link>
          <p className="nav-caption">Workspace</p>
          <nav className="nav-stack"><NavigationLinks /></nav>
          <nav className="mobile-menu" aria-label="Primary navigation"><NavigationLinks /></nav>
          <div className="side-bottom">
            <div className="api-chip" data-testid="status-api">
              <span className="api-dot" style={{ background: health.isError ? '#d97867' : undefined }} />
              <span>{health.isLoading ? 'Checking API…' : health.isError ? 'API unavailable' : 'API operational'}</span>
              <CircleDot size={13} style={{ marginLeft: 'auto', opacity: 0.55 }} />
            </div>
            <div className="side-user">
              <span className="avatar-initial">TR</span>
              <div><div className="user-name">TraceRoot workspace</div><div className="user-role">Engineering team</div></div>
              <ArrowUpRight size={14} style={{ marginLeft: 'auto', color: '#82929a' }} />
            </div>
          </div>
        </aside>
        <main className="main-panel">
          <header className="topbar">
            <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Investigation desk</strong></div>
            <div className="topbar-right"><span className="eyebrow">Production signals, made legible</span><Search size={15} color="#89939a" /></div>
          </header>
          {children}
        </main>
      </div>
      {notice && <div className="toast-message" role="status" data-testid="status-toast">{notice}</div>}
    </NoticeContext.Provider>
  );
}

export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="section-head">
    <div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>
    {action}
  </div>;
}

export function LoadingRows({ count = 4 }: { count?: number }) {
  return <div aria-label="Loading issues">{Array.from({ length: count }, (_, index) => <div className="loading-skeleton" key={index} />)}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><ListFilter size={19} /></span>
    <h3>Couldn’t load this view</h3><p>{message}</p>
    <button className="button-secondary" style={{ marginTop: 16 }} onClick={onRetry} data-testid="button-retry">Try again</button>
  </div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-icon"><Activity size={19} /></span><h3>{title}</h3><p>{detail}</p></div>;
}