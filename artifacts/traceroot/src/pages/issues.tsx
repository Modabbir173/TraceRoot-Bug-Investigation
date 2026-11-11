import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateIssue,
  useListIssues,
  getListIssuesQueryKey,
  getGetDashboardSummaryQueryKey,
  getListActivityQueryKey,
} from '@workspace/api-client-react';
import type {
  IssueInput,
  IssueSeverity,
  IssueStatus,
} from '@workspace/api-client-react';
import { Plus, Search, X } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeading,
  useNotice,
} from '@/components/app-shell';
import { IssueRow } from '@/components/issue-visuals';
import { errorMessage } from '@/lib/format';
import { listProjects, type Projects } from '@/lib/projects';

type IssueFormInput = IssueInput & {
  project_id: string | null;
};

const severities: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];
const statuses: IssueStatus[] = ['open', 'investigating', 'resolved'];

const emptyInput: IssueFormInput = {
  title: '',
  description: '',
  service: '',
  environment: 'production',
  severity: 'high',
  status: 'open',
  assignee: '',
  project_id: null,
};

export default function Issues() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<IssueFormInput>(emptyInput);

  const [projects, setProjects] = useState<Projects[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');

  const queryClient = useQueryClient();
  const notify = useNotice();
  const [, setLocation] = useLocation();

  const params = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status: status as IssueStatus } : {}),
      ...(severity ? { severity: severity as IssueSeverity } : {}),
    }),
    [search, status, severity],
  );

  const issues = useListIssues(params);
  const createIssue = useCreateIssue();

  useEffect(() => {
    let active = true;

    async function loadProjectOptions() {
      setProjectsLoading(true);
      setProjectsError('');

      try {
        const data = await listProjects();
        if (active) {
          setProjects(data);
        }
      } catch (error) {
        if (active) {
          setProjectsError(errorMessage(error));
        }
      } finally {
        if (active) {
          setProjectsLoading(false);
        }
      }
    }

    void loadProjectOptions();

    return () => {
      active = false;
    };
  }, []);

  function refreshRelated() {
    void queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: getGetDashboardSummaryQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getListActivityQueryKey(),
    });
  }

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const issuePayload = {
      ...form,
      assignee: form.assignee?.trim() || null,
      project_id: form.project_id || null,
    };

    createIssue.mutate(
      // The generated client types may not yet include project_id.
      // The backend accepts it; the property remains in the JSON request.
      { data: issuePayload as IssueInput },
      {
        onSuccess: (created) => {
          refreshRelated();
          setCreateOpen(false);
          setForm(emptyInput);
          notify('Issue recorded. Investigation trail started.');
          setLocation(`/issues/${encodeURIComponent(created.id)}`);
        },
      },
    );
  }

  function fieldChange(
    field: Exclude<keyof IssueFormInput, 'project_id'>,
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="content">
      <PageHeading
        title="Issues"
        subtitle="Search the incident stream, narrow the signal, and open an investigation."
        action={
          <button
            className="button-primary"
            onClick={() => setCreateOpen(true)}
            data-testid="button-create-issue"
          >
            <Plus size={15} /> Report issue
          </button>
        }
      />

      {createIssue.isError && (
        <div
          className="error-note"
          style={{ marginBottom: 15 }}
          data-testid="status-create-error"
        >
          {errorMessage(createIssue.error)}
        </div>
      )}

      <div className="toolbar">
        <div className="filters">
          <label className="searchbar">
            <Search size={15} />
            <input
              aria-label="Search issues"
              placeholder="Search title, service, or description…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              data-testid="input-search-issues"
            />
          </label>

          <select
            className="filter-select"
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            data-testid="select-filter-status"
          >
            <option value="">Every status</option>
            {statuses.map((item) => (
              <option value={item} key={item}>
                {item[0].toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            aria-label="Filter by severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            data-testid="select-filter-severity"
          >
            <option value="">Every severity</option>
            {severities.map((item) => (
              <option value={item} key={item}>
                {item[0].toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <span className="eyebrow">
          {issues.data?.length ?? (issues.isLoading ? '…' : 0)} matching issues
        </span>
      </div>

      <section className="panel">
        <div className="table-header">
          <span>Issue / Service</span>
          <span>Severity</span>
          <span>Status</span>
          <span>Owner</span>
        </div>

        {issues.isLoading ? (
          <LoadingRows count={5} />
        ) : issues.isError ? (
          <ErrorState
            message={errorMessage(issues.error)}
            onRetry={() => issues.refetch()}
          />
        ) : issues.data?.length ? (
          <div className="issue-list">
            {issues.data.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching issues"
            detail={
              search || status || severity
                ? 'Try a broader search or clear one of your filters.'
                : 'Nothing has been reported yet. Add the first issue when a production failure surfaces.'
            }
          />
        )}
      </section>

      {createOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCreateOpen(false);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: '#17243180',
            display: 'grid',
            placeItems: 'center',
            padding: 18,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            className="panel"
            style={{
              width: 'min(620px, 100%)',
              maxHeight: '90dvh',
              overflowY: 'auto',
              boxShadow: '0 24px 70px #1d2b3860',
            }}
          >
            <div className="panel-head">
              <div>
                <h2 className="panel-title" id="create-title">
                  Report an issue
                </h2>
                <div className="panel-kicker" style={{ marginTop: 4 }}>
                  Capture the signal before it gets noisy
                </div>
              </div>

              <button
                className="button-quiet"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
                data-testid="button-close-create"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={submitIssue} style={{ padding: 22 }}>
              <div className="form-grid">
                <label className="form-field full">
                  <span className="form-label">Issue title</span>
                  <input
                    className="field-input"
                    minLength={3}
                    required
                    value={form.title}
                    onChange={(event) =>
                      fieldChange('title', event.target.value)
                    }
                    placeholder="e.g. Checkout requests timing out after deploy"
                    data-testid="input-issue-title"
                  />
                </label>

                <label className="form-field">
                  <span className="form-label">Service</span>
                  <input
                    className="field-input"
                    required
                    value={form.service}
                    onChange={(event) =>
                      fieldChange('service', event.target.value)
                    }
                    placeholder="payments-api"
                    data-testid="input-issue-service"
                  />
                </label>

                <label className="form-field">
                  <span className="form-label">Environment</span>
                  <input
                    className="field-input"
                    required
                    value={form.environment}
                    onChange={(event) =>
                      fieldChange('environment', event.target.value)
                    }
                    placeholder="production"
                    data-testid="input-issue-environment"
                  />
                </label>

                <label className="form-field">
                  <span className="form-label">Severity</span>
                  <select
                    className="field-select"
                    value={form.severity}
                    onChange={(event) =>
                      fieldChange('severity', event.target.value)
                    }
                    data-testid="select-issue-severity"
                  >
                    {severities.map((item) => (
                      <option value={item} key={item}>
                        {item[0].toUpperCase() + item.slice(1)}
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
                      fieldChange('status', event.target.value)
                    }
                    data-testid="select-issue-status"
                  >
                    {statuses.map((item) => (
                      <option value={item} key={item}>
                        {item[0].toUpperCase() + item.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field full">
                  <span className="form-label">
                    Project <span style={{ color: '#9ba4a8', fontWeight: 500 }}>— optional</span>
                  </span>
                  <select
                    className="field-select"
                    value={form.project_id ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        project_id: event.target.value || null,
                      }))
                    }
                    disabled={projectsLoading}
                    data-testid="select-issue-project"
                  >
                    <option value="">
                      {projectsLoading
                        ? 'Loading projects…'
                        : 'No project (unassigned)'}
                    </option>
                    {projects.map((project) => (
                      <option value={project.id} key={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {projectsError && (
                    <span className="error-note" style={{ marginTop: 6 }}>
                      Could not load projects: {projectsError}
                    </span>
                  )}
                </label>

                <label className="form-field full">
                  <span className="form-label">What happened?</span>
                  <textarea
                    className="field-textarea"
                    minLength={3}
                    required
                    value={form.description}
                    onChange={(event) =>
                      fieldChange('description', event.target.value)
                    }
                    placeholder="Describe impact, symptoms, and what is known so far…"
                    data-testid="input-issue-description"
                  />
                </label>

                <label className="form-field full">
                  <span className="form-label">
                    Assignee{' '}
                    <span style={{ color: '#9ba4a8', fontWeight: 500 }}>
                      — optional
                    </span>
                  </span>
                  <input
                    className="field-input"
                    value={form.assignee ?? ''}
                    onChange={(event) =>
                      fieldChange('assignee', event.target.value)
                    }
                    placeholder="Name or handle"
                    data-testid="input-issue-assignee"
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setCreateOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </button>
                <button
                  className="button-primary"
                  type="submit"
                  disabled={createIssue.isPending}
                  data-testid="button-submit-issue"
                >
                  {createIssue.isPending ? 'Recording…' : 'Record issue'}
                </button>
              </div>

              {createIssue.isError && (
                <div className="error-note" style={{ marginTop: 14 }}>
                  {errorMessage(createIssue.error)}
                </div>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
