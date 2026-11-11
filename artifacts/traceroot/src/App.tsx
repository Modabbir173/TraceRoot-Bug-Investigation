import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import Login from '@/pages/login';
import Register from '@/pages/register';
import { useAuth } from '@/lib/auth-context';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import Issues from '@/pages/issues';
import Projects from '@/pages/projects';
import IssueDetail from '@/pages/issue-detail';
import Settings from '@/pages/settings';
import { ThemeProvider } from '@/lib/theme-context';
import { AuthProvider } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();


function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const isPublicRoute =
    location === '/login' || location === '/register';

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublicRoute) {
      setLocation('/login');
    } else if (user && isPublicRoute) {
      setLocation('/');
    }
  }, [isLoading, user, isPublicRoute, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading TraceRoot...
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={Login} />
      </Switch>
    );
  }

  if (isPublicRoute) {
    return null;
  }

  return (
    <RoutedErrorBoundary>
      <AppShell>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/projects" component={Projects} />
          <Route path="/issues" component={Issues} />
          <Route path="/settings" component={Settings} />
          <Route path="/issues/:issueId" component={IssueDetail} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </RoutedErrorBoundary>
  );
}


function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
