
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';

export default function Login() {
  const { signIn } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      setLocation('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Login failed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-split-page">
      {/* LEFT BRANDING PANEL */}
      <section className="auth-visual-panel">
        <div className="auth-visual-grid" />
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />

        <div className="auth-visual-content">
          <Link href="/login" className="auth-brand">
            <div className="auth-logo">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path
                  d="M24 3L43 14V34L24 45L5 34V14L24 3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M15 15H33V20H27V34H21V20H15V15Z"
                  fill="currentColor"
                />
                <path
                  d="M29 27L35 33"
                  stroke="#8B7CFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span>TraceRoot<span className="auth-brand-dot">.</span></span>
          </Link>

          <div className="auth-visual-message">
            <span className="auth-eyebrow">
              <span className="auth-status-dot" />
              SOFTWARE INTELLIGENCE PLATFORM
            </span>

            <h1>
              Find the root.
              <br />
              <span>Fix the cause.</span>
            </h1>

            <p>
              Investigate software failures, uncover hidden causes, and
              bring clarity to complex debugging workflows.
            </p>
          </div>

          <div className="auth-visual-art">
            <div className="auth-orbit auth-orbit-one" />
            <div className="auth-orbit auth-orbit-two" />
            <div className="auth-orbit auth-orbit-three" />

            <div className="auth-core">
              <div className="auth-core-inner">
                <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path
                    d="M24 5L40 14V34L24 43L8 34V14L24 5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M17 17H31V22H26V32H22V22H17V17Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>

            <span className="auth-node auth-node-one" />
            <span className="auth-node auth-node-two" />
            <span className="auth-node auth-node-three" />
            <span className="auth-node auth-node-four" />

            <div className="auth-floating-label auth-label-one">
              <span className="auth-mini-dot cyan" />
              SYSTEM ANALYSIS
            </div>
            <div className="auth-floating-label auth-label-two">
              <span className="auth-mini-dot violet" />
              ROOT CAUSE DETECTION
            </div>
          </div>
        </div>

        <div className="auth-visual-footer">
          <span>ENGINEERED FOR CLARITY</span>
          <span>© 2026 TRACEROOT</span>
        </div>
      </section>

      {/* RIGHT LOGIN PANEL */}
      <section className="auth-form-panel">
        <div className="auth-form-wrapper">
          <div className="auth-mobile-brand">
            <div className="auth-logo">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path
                  d="M24 3L43 14V34L24 45L5 34V14L24 3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M15 15H33V20H27V34H21V20H15V15Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span>TraceRoot<span className="auth-brand-dot">.</span></span>
          </div>

          <div className="auth-form-heading">
            <span className="auth-form-eyebrow">YOUR WORKSPACE AWAITS</span>
            <h2>Welcome back<span>.</span></h2>
            <p>Sign in to continue your investigation journey.</p>
          </div>

          <div className="auth-form-card">
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="field-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="field-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p className="error-note" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="button-primary auth-submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in to TraceRoot'}
                {!isSubmitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="auth-form-divider">
              <span>NEW TO TRACEROOT?</span>
            </div>

            <p className="auth-register-prompt">
              Don't have an account?{' '}
              <Link href="/register">Create an account <span>↗</span></Link>
            </p>
          </div>

          <div className="auth-security-note">
            <span className="auth-security-icon">◆</span>
            <span>Your workspace is protected with secure authentication.</span>
          </div>

          <p className="auth-form-copyright">
            TraceRoot · Software Bug Investigation Platform
          </p>
        </div>
      </section>
    </main>
  );
}
