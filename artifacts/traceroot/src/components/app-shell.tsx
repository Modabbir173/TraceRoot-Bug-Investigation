import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Activity, LogOut, Bug, CircleDot, LayoutDashboard, ListFilter, Search, FolderKanban, Settings } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';
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
      <Link
  href="/projects"
  className={`nav-link ${location.startsWith('/projects') ? 'active' : ''}`}
  data-testid="link-projects"
>
  <FolderKanban size={17} /> Projects
</Link>
      <Link href="/issues" className={`nav-link ${location.startsWith('/issues') ? 'active' : ''}`} data-testid="link-issues">
        <Bug size={17} /> Issues
      </Link>
        <Link
            href="/settings"
            className={`nav-link ${location.startsWith('/settings') ? 'active' : ''}`}
            data-testid="link-settings"
        >
            <Settings size={17} /> Settings
        </Link>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
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
  <span className="brand-mark">
    <svg viewBox="0 0 40 40" width="26" height="26" fill="none">
  {/* Custom T */}
  <path
    d="M4 9H19L16 13H13.5V31H9V13H4V9Z"
    fill="currentColor"
  />

  {/* Custom R */}
  <path
    d="M21 9H29C33.5 9 36 11.8 36 16C36 19 34.5 21 32 22.2L37 31H31.5L27 23H25.5V31H21V9Z"
    fill="currentColor"
  />
  <path
    d="M25.5 13.5V18.8H29C30.8 18.8 31.5 17.9 31.5 16.2C31.5 14.5 30.7 13.5 29 13.5H25.5Z"
    fill="#142D46"
  />
</svg>
  </span>
  <span className="brand-name">TraceRoot</span>
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
  <span className="avatar-initial">
    {user?.full_name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()}
  </span>

  <div style={{ minWidth: 0, flex: 1 }}>
    <div className="user-name">{user?.full_name}</div>
    <div className="user-role">{user?.email}</div>
  </div>

  <button
    type="button"
    onClick={() => {
      signOut();
      setLocation('/login');
    }}
    title="Sign out"
    aria-label="Sign out"
    className="button-quiet"
  >
    <LogOut size={16} />
  </button>
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