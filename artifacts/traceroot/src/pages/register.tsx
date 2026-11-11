import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';

export default function Register() {
  const { signUp } = useAuth();
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(fullName, email, password);
      setLocation('/');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page bg-background">
      <div className="auth-container">
        <div className="text-center mb-8">
          <div className="brand-mark mx-auto mb-4">T</div>
          <h1 className="text-3xl font-bold tracking-tight">TraceRoot</h1>
          <p className="text-muted-foreground mt-2">
            Create your account
          </p>
        </div>

        <div className="bg-card border rounded-xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Get started</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Create an account to start investigating software issues.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-field">
              <label htmlFor="fullName" className="form-label">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                className="field-input"
                placeholder="Your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
              />
            </div>

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
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="field-input"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
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
              className="button-primary w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-center mt-6 text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-primary">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">
          TraceRoot — Software Bug Investigation Platform
        </p>
      </div>
    </main>
  );
}
