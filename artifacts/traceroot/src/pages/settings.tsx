
import { useEffect, useState, type FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  UserRound,
  ShieldCheck,
  Save,
  LockKeyhole,
  Mail,
  User,
  Eye,
  EyeOff,
  LoaderCircle,
  Palette,
  Sun,
  Moon,
  Check,
  Minimize2,
  Accessibility,
  Sparkles,
  KeyRound,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { updateProfile, changePassword } from '@/lib/auth';
import { PageHeading, useNotice } from '@/components/app-shell';
import { useThemePreferences } from '@/lib/theme-context';

/* -------------------------------------------------------
   Shared UI Components
------------------------------------------------------- */

interface IconBadgeProps {
  icon: LucideIcon;
  color?: 'cyan' | 'violet' | 'amber' | 'emerald';
  size?: 'sm' | 'md';
}

function IconBadge({
  icon: Icon,
  color = 'cyan',
  size = 'md',
}: IconBadgeProps) {
  const colors = {
    cyan: 'bg-cyan-500/10 text-cyan-500 ring-cyan-500/10',
    violet: 'bg-violet-500/10 text-violet-500 ring-violet-500/10',
    amber: 'bg-amber-500/10 text-amber-500 ring-amber-500/10',
    emerald: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/10',
  };

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ring-1 ${
        size === 'md' ? 'h-11 w-11' : 'h-9 w-9'
      } ${colors[color]}`}
    >
      <Icon size={size === 'md' ? 20 : 17} strokeWidth={1.8} />
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  color = 'cyan',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: IconBadgeProps['color'];
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-5 sm:px-6">
      <IconBadge icon={icon} color={color} />

      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  toggle: () => void;
  placeholder: string;
  autoComplete: string;
  inputClass: string;
  labelClass: string;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  toggle,
  placeholder,
  autoComplete,
  inputClass,
  labelClass,
}: PasswordFieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${inputClass} pr-12`}
          required
        />

        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {visible ? (
            <EyeOff size={17} strokeWidth={1.8} />
          ) : (
            <Eye size={17} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  enabled,
  onToggle,
  color = 'cyan',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  color?: IconBadgeProps['color'];
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5">
          <IconBadge icon={icon} color={color} size="sm" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${
          enabled ? 'bg-cyan-600' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------
   Settings Page
------------------------------------------------------- */

export default function Settings() {
  const { user } = useAuth();
  const showNotice = useNotice();

  const {
    theme,
    setTheme,
    compactUI,
    setCompactUI,
    reduceMotion,
    setReduceMotion,
  } = useThemePreferences();

  // Profile
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.full_name, user?.email]);

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15';

  const labelClass =
    'mb-2 block text-sm font-medium text-foreground';

  /* Profile Update */

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim() || !email.trim()) {
      showNotice('Please fill in your name and email address.');
      return;
    }

    setIsSavingProfile(true);

    try {
      await updateProfile(fullName.trim(), email.trim());

      showNotice('Profile updated successfully.');
      window.location.reload();
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : 'Unable to update your profile.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  /* Password Update */

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotice('Please complete all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      showNotice('New password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotice('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      showNotice('New password must be different from the current password.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await changePassword(currentPassword, newPassword);

      showNotice(result.message || 'Password changed successfully.');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : 'Unable to change your password.'
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="settings-page space-y-6 pb-10">
      <PageHeading
        title="Settings"
        subtitle="Manage your account, security and workspace preferences."
      />

      {/* Workspace Hero */}

      <section className="relative isolate overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 -z-10 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              <Sparkles size={13} />
              Workspace Configuration
            </div>

            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Make TraceRoot yours.
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Personalize your workspace, manage account security and
              configure the interface to match your workflow.
            </p>
          </div>

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-inner shadow-cyan-400/5">
            <ShieldCheck size={30} strokeWidth={1.6} />
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3 border-t border-white/10 pt-5">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Account settings
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Security controls
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Workspace preferences
          </div>
        </div>
      </section>

      {/* Profile Information */}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={UserRound}
          title="Profile Information"
          description="Manage your personal account information."
          color="cyan"
        />

        <form onSubmit={handleProfileSubmit} className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="settings-full-name" className={labelClass}>
                Full Name
              </label>

              <div className="relative">
                <User
                  size={17}
                  strokeWidth={1.8}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />

                <input
                  id="settings-full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className={`${inputClass} pl-11`}
                  required
                />
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="settings-email" className={labelClass}>
                Email Address
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  strokeWidth={1.8}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />

                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  className={`${inputClass} pl-11`}
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-5">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cyan-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProfile ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Security */}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={LockKeyhole}
          title="Security & Password"
          description="Protect your account by maintaining a strong password."
          color="violet"
        />

        <form onSubmit={handlePasswordSubmit} className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <PasswordField
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              visible={showCurrentPassword}
              toggle={() => setShowCurrentPassword((value) => !value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              inputClass={inputClass}
              labelClass={labelClass}
            />

            <div className="hidden md:block" />

            <PasswordField
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              visible={showNewPassword}
              toggle={() => setShowNewPassword((value) => !value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              inputClass={inputClass}
              labelClass={labelClass}
            />

            <PasswordField
              id="confirm-new-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showConfirmPassword}
              toggle={() => setShowConfirmPassword((value) => !value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              inputClass={inputClass}
              labelClass={labelClass}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <IconBadge icon={KeyRound} color="cyan" size="sm" />

              <div>
                <p className="text-sm font-medium text-foreground">
                  Password requirements
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use at least 8 characters for your new password.
                </p>
              </div>
            </div>

            <span className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              Minimum 8 characters
            </span>
          </div>

          <div className="flex justify-end border-t border-border pt-5">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChangingPassword ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <ShieldCheck size={17} />
              )}
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Appearance */}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={Palette}
          title="Appearance"
          description="Choose the visual theme for your TraceRoot workspace."
          color="amber"
        />

        <div className="p-5 sm:p-6">
          <p className="mb-4 text-sm font-medium text-foreground">
            Color Theme
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`group flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all ${
                theme === 'light'
                  ? 'border-cyan-500 bg-cyan-500/5 ring-2 ring-cyan-500/10'
                  : 'border-border hover:border-cyan-500/40 hover:bg-muted/30'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Sun size={21} strokeWidth={1.8} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Light Mode
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Clean and bright interface
                  </p>
                </div>
              </div>

              {theme === 'light' && (
                <Check size={19} className="shrink-0 text-cyan-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`group flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all ${
                theme === 'dark'
                  ? 'border-cyan-500 bg-cyan-500/5 ring-2 ring-cyan-500/10'
                  : 'border-border hover:border-cyan-500/40 hover:bg-muted/30'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Moon size={21} strokeWidth={1.8} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Dark Mode
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Comfortable dark interface
                  </p>
                </div>
              </div>

              {theme === 'dark' && (
                <Check size={19} className="shrink-0 text-cyan-500" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Interface Preferences */}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={Accessibility}
          title="Interface Preferences"
          description="Fine-tune the interface to match your working style."
          color="emerald"
        />

        <div className="divide-y divide-border">
          <PreferenceRow
            icon={Minimize2}
            title="Compact Interface"
            description="Reduce spacing to fit more content on screen."
            enabled={compactUI}
            onToggle={() => setCompactUI(!compactUI)}
            color="cyan"
          />

          <PreferenceRow
            icon={Accessibility}
            title="Reduce Motion"
            description="Minimize animations and transitions across the interface."
            enabled={reduceMotion}
            onToggle={() => setReduceMotion(!reduceMotion)}
            color="violet"
          />
        </div>
      </section>

      {/* Footer */}

      <div className="flex flex-wrap items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
        <ShieldCheck size={15} className="text-emerald-500" />
        <span>Your workspace preferences are saved locally.</span>
      </div>
    </div>
  );
}
