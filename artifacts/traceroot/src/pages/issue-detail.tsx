
import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetDashboardSummaryQueryKey,
  getGetIssueQueryKey,
  getListActivityQueryKey,
  getListIssuesQueryKey,
  useDeleteIssue,
  useGetIssue,
  useListActivity,
  useUpdateIssue,
} from '@workspace/api-client-react';
import type {
  IssueInput,
  IssueSeverity,
  IssueStatus,
} from '@workspace/api-client-react';
import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  Save,
  Trash2,
} from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeading,
  useNotice,
} from '@/components/app-shell';
import {
  errorMessage,
  formatDate,
  humanize,
  relativeTime,
} from '@/lib/format';
import { getProject, type Projects } from '@/lib/projects';

const severities: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];
const statuses: IssueStatus[] = ['open', 'investigating', 'resolved'];

export default function IssueDetail() {
  const [, params] = useRoute('/issues/:issueId');
  const issueId = params?.issueId ?? '';

  const issueQuery = useGetIssue(issueId);
  const issue = issueQuery.data;

  const activity = useListActivity({ limit: 50 });
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  const queryClient = useQueryClient();
  const notify = useNotice();
  const [, setLocation] = useLocation();

  const [form, setForm] = useState<IssueInput | null>(null);
  const [associatedProject, setAssociatedProject] =
    useState<Projects | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);

  // Read the associated project ID from the issue response.
  const projectId =
    (
      issue as
        | (typeof issue & { project_id?: string | null })
        | undefined
    )?.project_id ?? null;

  // Populate the editable issue form.
  useEffect(() => {
    if (!issue) {
      setForm(null);
      return;
    }

    setForm({
      title: issue.title,
      description: issue.description,
      service: issue.service,
      environment: issue.environment,
      severity: issue.severity,
      status: issue.status,
      assignee: issue.assignee ?? '',
    });
  }, [issue]);

  // Load the project associated with this issue.
  useEffect(() => {
    let active = true;

    async function loadAssociatedProject() {
      if (!projectId) {
        setAssociatedProject(null);
        setProjectLoading(false);
        return;
      }

      setProjectLoading(true);

      try {
        const project = await getProject(projectId);

        if (active) {
          setAssociatedProject(project);
        }
      } catch {
        if (active) {
          setAssociatedProject(null);
        }
      } finally {
        if (active) {
          setProjectLoading(false);
        }
      }
    }

    void loadAssociatedProject();

    return () => {
      active = false;
    };
  }, [projectId]);

  function invalidateRelated() {
    void queryClient.invalidateQueries({
      queryKey: getGetIssueQueryKey(issueId),
    });

    void queryClient.invalidateQueries({
      queryKey: getListIssuesQueryKey(),
    });

    void queryClient.invalidateQueries({
      queryKey: getGetDashboardSummaryQueryKey(),
    });

    void queryClient.invalidateQueries({
      queryKey: getListActivityQueryKey(),
    });
  }

  function updateField(field: keyof IssueInput, value: string) {
    setForm((current) =>
      current
        ? { ...current, [field]: value } as IssueInput
        : current,
    );
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) return;

    updateIssue.mutate(
      {
        issueId,
        data: {
          ...form,
          assignee: form.assignee?.trim() || null,
        },
      },
      {
        onSuccess: () => {
          invalidateRelated();
          notify('Investigation updated.');
        },
      },
    );
  }

  function removeIssue() {
    if (
      !issue ||
      !window.confirm(
        `Delete “${issue.title}”? This cannot be undone.`,
      )
    ) {
      return;
    }

    deleteIssue.mutate(
      { issueId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetIssueQueryKey(issueId),
          });

          void queryClient.invalidateQueries({
            queryKey: getListIssuesQueryKey(),
          });

          void queryClient.invalidateQueries({
            queryKey: getGetDashboardSummaryQueryKey(),
          });

          void queryClient.invalidateQueries({
            queryKey: getListActivityQueryKey(),
          });

          notify('Issue deleted.');
          setLocation('/issues');
        },
      },
    );
  }

  const issueActivity =
    activity.data?.filter((item) => item.issue_id === issueId) ?? [];

  if (issueQuery.isLoading) {
    return (
      <div className="content">
        <PageHeading
          title="Loading investigation"
          subtitle="Fetching issue details and trace context."
        />
        <section className="panel">
          <LoadingRows count={5} />
        </section>
      </div>
    );
  }

  if (issueQuery.isError) {
    return (
      <div className="content">
        <Link
          href="/issues"
          className="button-quiet"
          data-testid="link-back-issues"
        >
          <ArrowLeft size={14} /> Back to issues
        </Link>

        <section className="panel" style={{ marginTop: 20 }}>
          <ErrorState
            message={errorMessage(issueQuery.error)}
            onRetry={() => issueQuery.refetch()}
          />
        </section>
      </div>
    );
  }

  if (!issue || !form) {
    return (
      <div className="content">
        <EmptyState
          title="Issue not found"
          detail="This record may have been removed or the link may be incomplete."
        />

        <Link
          href="/issues"
          className="button-secondary"
          data-testid="link-return-issues"
        >
          Return to issues
        </Link>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="detail-header">
        <div>
          <Link
            href="/issues"
            className="button-quiet"
            style={{ paddingLeft: 0, marginBottom: 16 }}
            data-testid="link-back-issues"
          >
            <ArrowLeft size={14} /> All issues
          </Link>

          <div className="detail-topline">
            <span className={`severity-pill severity-${issue.severity}`}>
              {humanize(issue.severity)} severity
            </span>

            <span className={`status-pill status-${issue.status}`}>
              {humanize(issue.status)}
            </span>

            <span className="eyebrow">ID {issue.id}</span>
          </div>

          <h1 className="page-title" data-testid="text-issue-title">
            {issue.title}
          </h1>

          <p className="page-subtitle">
            {issue.service}
            <span style={{ margin: '0 5px' }}>·</span>
            {issue.environment}
            <span style={{ margin: '0 5px' }}>·</span>
            Created {formatDate(issue.created_at)}
          </p>
        </div>

        <button
          className="button-danger"
          onClick={removeIssue}
          disabled={deleteIssue.isPending}
          data-testid="button-delete-issue"
        >
          <Trash2 size={14} />
          {deleteIssue.isPending ? 'Deleting…' : 'Delete issue'}
        </button>
      </div>

      {(updateIssue.isError || deleteIssue.isError) && (
        <div
          className="error-note"
          style={{ marginBottom: 16 }}
          data-testid="status-mutation-error"
        >
          {errorMessage(updateIssue.error || deleteIssue.error)}
        </div>
      )}

      <div className="detail-grid">
        <div style={{ display: 'grid', gap: 17 }}>
          <form className="panel detail-card" onSubmit={save}>
            <div
              className="panel-head"
              style={{ margin: '-22px -22px 20px' }}
            >
              <div>
                <h2 className="panel-title">Investigation record</h2>
                <div className="panel-kicker" style={{ marginTop: 4 }}>
                  Maintain a clear, durable account of the failure
                </div>
              </div>

              <Save size={16} color="#7c9290" />
            </div>

            <div className="form-grid">
              <label className="form-field full">
                <span className="form-label">Issue title</span>
                <input
                  className="field-input"
                  required
                  minLength={3}
                  value={form.title}
                  onChange={(event) =>
                    updateField('title', event.target.value)
                  }
                  data-testid="input-edit-title"
                />
              </label>

              <label className="form-field">
                <span className="form-label">Service</span>
                <input
                  className="field-input"
                  required
                  value={form.service}
                  onChange={(event) =>
                    updateField('service', event.target.value)
                  }
                  data-testid="input-edit-service"
                />
              </label>

              <label className="form-field">
                <span className="form-label">Environment</span>
                <input
                  className="field-input"
                  required
                  value={form.environment}
                  onChange={(event) =>
                    updateField('environment', event.target.value)
                  }
                  data-testid="input-edit-environment"
                />
              </label>

              <label className="form-field">
                <span className="form-label">Severity</span>
                <select
                  className="field-select"
                  value={form.severity}
                  onChange={(event) =>
                    updateField('severity', event.target.value)
                  }
                  data-testid="select-edit-severity"
                >
                  {severities.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span className="form-label">Status</span>
                <select
                  className="field-select"
                  value={form.status}
                  onChange={(event) =>
                    updateField('status', event.target.value)
                  }
                  data-testid="select-edit-status"
                >
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field full">
                <span className="form-label">
                  Description & investigation notes
                </span>
                <textarea
                  className="field-textarea"
                  required
                  minLength={3}
                  value={form.description}
                  onChange={(event) =>
                    updateField('description', event.target.value)
                  }
                  data-testid="input-edit-description"
                />
              </label>

              <label className="form-field full">
                <span className="form-label">Assignee</span>
                <input
                  className="field-input"
                  value={form.assignee ?? ''}
                  onChange={(event) =>
                    updateField('assignee', event.target.value)
                  }
                  placeholder="Unassigned"
                  data-testid="input-edit-assignee"
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                className="button-primary"
                type="submit"
                disabled={updateIssue.isPending}
                data-testid="button-save-issue"
              >
                {updateIssue.isPending
                  ? 'Saving changes…'
                  : 'Save changes'}
              </button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Activity trail</h2>
                <div className="panel-kicker" style={{ marginTop: 4 }}>
                  Recorded actions on this issue
                </div>
              </div>

              <Clock3 size={15} color="#87949a" />
            </div>

            {activity.isLoading ? (
              <LoadingRows count={3} />
            ) : activity.isError ? (
              <ErrorState
                message={errorMessage(activity.error)}
                onRetry={() => activity.refetch()}
              />
            ) : issueActivity.length ? (
              <div className="timeline">
                {issueActivity.map((item) => (
                  <div
                    className="timeline-entry"
                    key={item.id}
                    data-testid={`timeline-entry-${item.id}`}
                  >
                    <span className="timeline-dot" />

                    <div className="timeline-text">
                      <strong>{item.actor}</strong>{' '}
                      {humanize(item.action)}

                      <div className="timeline-time">
                        {relativeTime(item.created_at)}
                        <span style={{ margin: '0 4px' }}>·</span>
                        {formatDate(item.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No recorded actions"
                detail="Issue activity will appear here as changes are recorded."
              />
            )}
          </section>
        </div>

        <aside className="panel detail-card">
          <div className="panel-kicker" style={{ marginBottom: 21 }}>
            Issue context
          </div>

          <div className="detail-controls">
            <div className="detail-control">
              <span className="detail-label">Current status</span>
              <span className={`status-pill status-${issue.status}`}>
                {humanize(issue.status)}
              </span>
            </div>

            <div className="detail-control">
              <span className="detail-label">Severity</span>
              <span className={`severity-pill severity-${issue.severity}`}>
                {humanize(issue.severity)}
              </span>
            </div>

            <div className="detail-control">
              <span className="detail-label">Service</span>
              <span className="detail-value">{issue.service}</span>
            </div>

            <div className="detail-control">
              <span className="detail-label">Environment</span>
              <span className="detail-value">{issue.environment}</span>
            </div>

            <div className="detail-control">
              <span className="detail-label">Assigned to</span>
              <span className="detail-value">
                {issue.assignee || 'Unassigned'}
              </span>
            </div>

            <div className="detail-control">
              <span className="detail-label">Associated project</span>

              {projectLoading ? (
                <span className="detail-value">Loading project...</span>
              ) : associatedProject ? (
                <Link
                  href="/projects"
                  className="detail-value"
                  style={{
                    color: 'var(--accent, #159fc4)',
                    textDecoration: 'none',
                    fontWeight: 650,
                  }}
                  data-testid="link-associated-project"
                >
                  {associatedProject.name} →
                </Link>
              ) : (
                <span className="detail-value">
                  {projectId ? 'Project unavailable' : 'Unassigned'}
                </span>
              )}
            </div>

            <div className="detail-control">
              <span className="detail-label">Last updated</span>
              <span className="detail-value">
                {formatDate(issue.updated_at)}
              </span>
            </div>

            <div
              style={{
                borderTop: '1px solid #e5e7e1',
                paddingTop: 16,
                color: '#849097',
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              Keep edits focused on observable impact, contributing changes,
              and verified cause.
            </div>

            <Link
              href="/issues"
              className="button-secondary"
              style={{ width: '100%' }}
              data-testid="link-issue-list"
            >
              <ExternalLink size={14} /> Return to issue list
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
