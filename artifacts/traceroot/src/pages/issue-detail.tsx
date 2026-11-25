import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  FileArchive,
  FileText,
  Play,
  Upload,
  XCircle,
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

type EvidenceItem = {
  id: string;
  issue_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
};

type AnalysisResult = {
  analysis_id?: string;
  filename?: string;
  analysis_method?: string;
  summary?: Record<string, number>;
  errors?: Array<{ line: number; message: string }>;
  warnings?: Array<{ line: number; message: string }>;
  stack_traces?: Array<{ file: string; line: number; log_line?: number }>;
  root_causes?: Array<{
    category: string;
    explanation: string;
    recommendation: string;
    confidence?: string;
  }>;
  source_files?: Array<{
    file: string;
    extension: string;
    line_count: number;
    size: number;
  }>;
  problematic_files?: Array<{
    file: string;
    line: number;
    line_content?: string | null;
    match_type: string;
  }>;
  skipped_files?: string[];
  limitations?: string;
};


type ReportListItem = {
  id: string;
  issue_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type InvestigationReport = ReportListItem & {
  report_data: {
    issue: {
      id: string;
      title: string;
      description: string;
      reproduction_steps?: string;
      service: string;
      environment: string;
      severity: string;
      status: string;
      assignee?: string | null;
      created_at: string;
      updated_at: string;
    };
    analysis_count: number;
    analyses: Array<{
      analysis_id: string;
      analysis_type: string;
      evidence_id?: string | null;
      created_at: string;
      result: AnalysisResult & Record<string, unknown>;
    }>;
    generated_at: string;
    analysis_note: string;
  };
};

const TOKEN_KEY = 'traceroot_access_token';

async function evidenceApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Request failed (${response.status}).`);
  }

  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


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
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [sourceZip, setSourceZip] = useState<File | null>(null);
  const [stackTraces, setStackTraces] = useState('[]');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [busyEvidenceId, setBusyEvidenceId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState<InvestigationReport | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportActionError, setReportActionError] = useState('');
  const [exportingReport, setExportingReport] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);


  const loadEvidence = useCallback(async () => {
    setEvidenceLoading(true);
    setEvidenceError('');
    try {
      const items = await evidenceApi<EvidenceItem[]>(`/issues/${issueId}/evidence`);
      setEvidence(items);
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Unable to load evidence.');
    } finally {
      setEvidenceLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evidenceFile) return;
    const data = new FormData();
    data.append('file', evidenceFile);
    setUploadingEvidence(true);
    setEvidenceError('');
    try {
      await evidenceApi(`/issues/${issueId}/evidence`, { method: 'POST', body: data });
      setEvidenceFile(null);
      const input = document.getElementById('evidence-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadEvidence();
      notify('Evidence uploaded successfully.');
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Evidence upload failed.');
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function uploadSourceCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceZip) return;
    const data = new FormData();
    data.append('file', sourceZip);
    setUploadingSource(true);
    setEvidenceError('');
    try {
      await evidenceApi(`/issues/${issueId}/source-code`, { method: 'POST', body: data });
      setSourceZip(null);
      const input = document.getElementById('source-zip-input') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadEvidence();
      notify('Source code ZIP uploaded successfully.');
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Source code upload failed.');
    } finally {
      setUploadingSource(false);
    }
  }

  async function runLogAnalysis(item: EvidenceItem) {
    setBusyEvidenceId(item.id);
    setAnalysisError('');
    setAnalysisResult(null);
    try {
      const result = await evidenceApi<AnalysisResult>(
        `/issues/${issueId}/evidence/${item.id}/analyze`,
        { method: 'POST' },
      );
      setAnalysisResult(result);
      notify('Log analysis completed.');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Log analysis failed.');
    } finally {
      setBusyEvidenceId(null);
    }
  }

  async function runSourceAnalysis(item: EvidenceItem) {
    let parsedTraces: unknown;
    try {
      parsedTraces = JSON.parse(stackTraces || '[]');
      if (!Array.isArray(parsedTraces)) throw new Error('Stack traces must be a JSON array.');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Invalid stack trace JSON.');
      return;
    }

    const data = new FormData();
    data.append('stack_traces', JSON.stringify(parsedTraces));
    setBusyEvidenceId(item.id);
    setAnalysisError('');
    setAnalysisResult(null);
    try {
      const result = await evidenceApi<AnalysisResult>(
        `/issues/${issueId}/source-code/${item.id}/analyze`,
        { method: 'POST', body: data },
      );
      setAnalysisResult(result);
      notify('Source code analysis completed.');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Source code analysis failed.');
    } finally {
      setBusyEvidenceId(null);
    }
  }

  async function downloadEvidence(item: EvidenceItem) {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const response = await fetch(`/api/issues/${issueId}/evidence/${item.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || 'Download failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.original_filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Unable to download evidence.');
    }
  }

  async function removeEvidence(item: EvidenceItem) {
    if (!window.confirm(`Delete evidence “${item.original_filename}”?`)) return;
    setBusyEvidenceId(item.id);
    try {
      await evidenceApi(`/issues/${issueId}/evidence/${item.id}`, { method: 'DELETE' });
      if (analysisResult?.filename === item.original_filename) setAnalysisResult(null);
      await loadEvidence();
      notify('Evidence deleted.');
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Evidence deletion failed.');
    } finally {
      setBusyEvidenceId(null);
    }
  }



  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError('');
    try {
      const query = new URLSearchParams({ issue_id: issueId });
      if (reportSearch.trim()) query.set('search', reportSearch.trim());
      const items = await evidenceApi<ReportListItem[]>(`/reports?${query.toString()}`);
      setReports(items);
    } catch (error) {
      setReportsError(error instanceof Error ? error.message : 'Unable to load reports.');
    } finally {
      setReportsLoading(false);
    }
  }, [issueId, reportSearch]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function generateInvestigationReport() {
    setGeneratingReport(true);
    setReportActionError('');
    try {
      const report = await evidenceApi<InvestigationReport>(`/issues/${issueId}/reports`, {
        method: 'POST',
      });
      await loadReports();
      setSelectedReport(report);
      notify('Investigation report generated successfully.');
    } catch (error) {
      setReportActionError(error instanceof Error ? error.message : 'Report generation failed.');
    } finally {
      setGeneratingReport(false);
    }
  }

  async function openReport(reportId: string) {
    setReportDetailLoading(true);
    setReportActionError('');
    try {
      const report = await evidenceApi<InvestigationReport>(`/reports/${reportId}`);
      setSelectedReport(report);
    } catch (error) {
      setReportActionError(error instanceof Error ? error.message : 'Unable to load report details.');
    } finally {
      setReportDetailLoading(false);
    }
  }

  async function exportReport(reportId: string, format: 'pdf' | 'json') {
    setExportingReport(`${reportId}:${format}`);
    setReportActionError('');
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const response = await fetch(
        `/api/reports/${reportId}/export?format=${format}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || `Report export failed (${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `TraceRoot-${reportId}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`${format.toUpperCase()} report downloaded.`);
    } catch (error) {
      setReportActionError(error instanceof Error ? error.message : 'Report export failed.');
    } finally {
      setExportingReport(null);
    }
  }

  async function updateInvestigationStatus(nextStatus: IssueStatus) {
    setUpdatingStatus(true);
    setReportActionError('');
    try {
      const query = new URLSearchParams({ new_status: nextStatus });
      await evidenceApi(`/issues/${issueId}/status?${query.toString()}`, {
        method: 'PATCH',
      });
      await queryClient.invalidateQueries({ queryKey: getGetIssueQueryKey(issueId) });
      await queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() });
      notify('Investigation status updated.');
    } catch (error) {
      setReportActionError(error instanceof Error ? error.message : 'Status update failed.');
    } finally {
      setUpdatingStatus(false);
    }
  }

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
                <h2 className="panel-title">Evidence & Analysis</h2>
                <div className="panel-kicker" style={{ marginTop: 4 }}>
                  Upload logs or source code and inspect rule-based findings
                </div>
              </div>
              <FileText size={16} color="#87949a" />
            </div>

            {evidenceError && (
              <div className="error-note" style={{ marginBottom: 14 }}>
                <XCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {evidenceError}
              </div>
            )}

            <div className="form-grid" style={{ marginBottom: 18 }}>
              <form className="form-field full" onSubmit={uploadEvidence}>
                <span className="form-label">Upload log evidence</span>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <input
                    id="evidence-file-input"
                    className="field-input"
                    style={{ flex: '1 1 220px' }}
                    type="file"
                    accept=".log,.txt,.json,text/plain,application/json"
                    onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                  />
                  <button className="button-primary" type="submit" disabled={!evidenceFile || uploadingEvidence}>
                    <Upload size={14} /> {uploadingEvidence ? 'Uploading…' : 'Upload log'}
                  </button>
                </div>
                <span className="form-hint">Supported: .log, .txt, .json · Maximum 10 MB</span>
              </form>

              <form className="form-field full" onSubmit={uploadSourceCode}>
                <span className="form-label">Upload source code ZIP</span>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <input
                    id="source-zip-input"
                    className="field-input"
                    style={{ flex: '1 1 220px' }}
                    type="file"
                    accept=".zip,application/zip"
                    onChange={(event) => setSourceZip(event.target.files?.[0] ?? null)}
                  />
                  <button className="button-secondary" type="submit" disabled={!sourceZip || uploadingSource}>
                    <FileArchive size={14} /> {uploadingSource ? 'Uploading…' : 'Upload ZIP'}
                  </button>
                </div>
                <span className="form-hint">ZIP only · Maximum 25 MB</span>
              </form>
            </div>

            <div className="panel-kicker" style={{ marginBottom: 10 }}>Uploaded evidence</div>
            {evidenceLoading ? (
              <LoadingRows count={2} />
            ) : evidence.length === 0 ? (
              <EmptyState title="No evidence uploaded" detail="Upload a log file or source code ZIP to begin analysis." />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {evidence.map((item) => {
                  const isZip = item.original_filename.toLowerCase().endsWith('.zip');
                  const isBusy = busyEvidenceId === item.id;
                  return (
                    <div key={item.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {isZip ? <FileArchive size={19} color="#87949a" /> : <FileText size={19} color="#87949a" />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 650, overflowWrap: 'anywhere' }}>{item.original_filename}</div>
                          <div className="timeline-time">{formatFileSize(item.file_size)} · Uploaded {formatDate(item.uploaded_at)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        <button type="button" className="button-quiet" onClick={() => void downloadEvidence(item)} title="Download evidence">
                          <Download size={14} /> Download
                        </button>
                        {isZip ? (
                          <button type="button" className="button-primary" onClick={() => void runSourceAnalysis(item)} disabled={isBusy}>
                            <Code2 size={14} /> {isBusy ? 'Analyzing…' : 'Analyze ZIP'}
                          </button>
                        ) : (
                          <button type="button" className="button-primary" onClick={() => void runLogAnalysis(item)} disabled={isBusy}>
                            <Play size={14} /> {isBusy ? 'Analyzing…' : 'Analyze log'}
                          </button>
                        )}
                        <button type="button" className="button-quiet" onClick={() => void removeEvidence(item)} disabled={isBusy} title="Delete evidence">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {evidence.some((item) => item.original_filename.toLowerCase().endsWith('.zip')) && (
              <div style={{ marginTop: 18 }}>
                <label className="form-field">
                  <span className="form-label">Optional stack traces for source matching (JSON array)</span>
                  <textarea
                    className="field-textarea"
                    rows={3}
                    value={stackTraces}
                    onChange={(event) => setStackTraces(event.target.value)}
                    placeholder={'[{"file":"src/main.py","line":42}]'}
                  />
                </label>
                <div className="form-hint">Example: <code>{'[{"file":"src/main.py","line":42}]'}</code>. Leave as [] if you do not have stack traces.</div>
              </div>
            )}

            {analysisError && (
              <div className="error-note" style={{ marginTop: 16 }}>
                <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {analysisError}
              </div>
            )}

            {analysisResult && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckCircle2 size={17} color="#16a36a" />
                  <h3 className="panel-title">Analysis Results</h3>
                  <span className="eyebrow" style={{ marginLeft: 'auto' }}>{analysisResult.analysis_method}</span>
                </div>

                {analysisResult.summary && (
                  <div className="form-grid" style={{ marginBottom: 16 }}>
                    {Object.entries(analysisResult.summary).map(([key, value]) => (
                      <div key={key} className="detail-control" style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 9, padding: 10 }}>
                        <span className="detail-label">{humanize(key.replaceAll('_', ' '))}</span>
                        <strong style={{ fontSize: 20 }}>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {!!analysisResult.root_causes?.length && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="panel-kicker" style={{ marginBottom: 9 }}>Possible root causes</div>
                    <div style={{ display: 'grid', gap: 9 }}>
                      {analysisResult.root_causes.map((cause, index) => (
                        <div key={`${cause.category}-${index}`} style={{ padding: 12, borderRadius: 9, background: 'var(--surface-subtle, rgba(127,127,127,.07))' }}>
                          <strong>{cause.category}</strong>
                          <p style={{ margin: '6px 0', fontSize: 13 }}>{cause.explanation}</p>
                          <p style={{ margin: 0, fontSize: 13 }}><strong>Recommendation:</strong> {cause.recommendation}</p>
                          {cause.confidence && <div className="timeline-time" style={{ marginTop: 6 }}>Confidence: {cause.confidence}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!!analysisResult.errors?.length && (
                  <details style={{ marginBottom: 10 }} open>
                    <summary className="form-label" style={{ cursor: 'pointer' }}>Errors ({analysisResult.errors.length})</summary>
                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                      {analysisResult.errors.map((entry, index) => <div key={index} className="error-note">Line {entry.line}: {entry.message}</div>)}
                    </div>
                  </details>
                )}
                {!!analysisResult.warnings?.length && (
                  <details style={{ marginBottom: 10 }}>
                    <summary className="form-label" style={{ cursor: 'pointer' }}>Warnings ({analysisResult.warnings.length})</summary>
                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                      {analysisResult.warnings.map((entry, index) => <div key={index} className="detail-value">Line {entry.line}: {entry.message}</div>)}
                    </div>
                  </details>
                )}
                {!!analysisResult.stack_traces?.length && (
                  <details style={{ marginBottom: 10 }}>
                    <summary className="form-label" style={{ cursor: 'pointer' }}>Stack traces ({analysisResult.stack_traces.length})</summary>
                    <ul style={{ paddingLeft: 20, fontSize: 13 }}>{analysisResult.stack_traces.map((entry, index) => <li key={index}>{entry.file} · line {entry.line}</li>)}</ul>
                  </details>
                )}
                {!!analysisResult.source_files?.length && (
                  <details style={{ marginBottom: 10 }}>
                    <summary className="form-label" style={{ cursor: 'pointer' }}>Source files found ({analysisResult.source_files.length})</summary>
                    <div style={{ display: 'grid', gap: 5, marginTop: 8 }}>
                      {analysisResult.source_files.map((entry, index) => <div key={index} className="detail-value">{entry.file} · {entry.line_count} lines · {formatFileSize(entry.size)}</div>)}
                    </div>
                  </details>
                )}
                {!!analysisResult.problematic_files?.length && (
                  <div style={{ marginBottom: 10 }}>
                    <div className="form-label">Stack trace file matches</div>
                    {analysisResult.problematic_files.map((entry, index) => (
                      <div key={index} className="detail-control" style={{ padding: 9, marginTop: 6, background: 'var(--surface-subtle, rgba(127,127,127,.07))', borderRadius: 8 }}>
                        <strong>{entry.file}:{entry.line}</strong>
                        {entry.line_content && <code style={{ display: 'block', marginTop: 5, whiteSpace: 'pre-wrap' }}>{entry.line_content}</code>}
                      </div>
                    ))}
                  </div>
                )}
                {!!analysisResult.skipped_files?.length && (
                  <details style={{ marginBottom: 10 }}>
                    <summary className="form-label">Skipped files ({analysisResult.skipped_files.length})</summary>
                    <ul style={{ paddingLeft: 20, fontSize: 13 }}>{analysisResult.skipped_files.map((file, index) => <li key={index}>{file}</li>)}</ul>
                  </details>
                )}
                {analysisResult.limitations && (
                  <div className="form-hint" style={{ marginTop: 12, display: 'flex', gap: 7 }}>
                    <AlertTriangle size={14} /> <span>{analysisResult.limitations}</span>
                  </div>
                )}
                <div className="timeline-time" style={{ marginTop: 10 }}>Analysis ID: {analysisResult.analysis_id ?? 'Saved'}</div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Investigation Reports</h2>
                <div className="panel-kicker" style={{ marginTop: 4 }}>
                  Generate, review and export a consolidated investigation report
                </div>
              </div>
              <FileText size={16} color="#87949a" />
            </div>

            {reportActionError && (
              <div className="error-note" style={{ marginBottom: 14 }}>
                <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {reportActionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 16 }}>
              <button
                type="button"
                className="button-primary"
                onClick={() => void generateInvestigationReport()}
                disabled={generatingReport}
                data-testid="button-generate-report"
              >
                <FileText size={14} />
                {generatingReport ? 'Generating report…' : 'Generate report'}
              </button>
              <button
                type="button"
                className="button-quiet"
                onClick={() => void loadReports()}
                disabled={reportsLoading}
              >
                {reportsLoading ? 'Refreshing…' : 'Refresh history'}
              </button>
            </div>

            <label className="form-field" style={{ marginBottom: 14 }}>
              <span className="form-label">Search reports</span>
              <input
                className="field-input"
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder="Search by report or issue title"
                data-testid="input-report-search"
              />
            </label>

            {reportsError && (
              <div className="error-note" style={{ marginBottom: 12 }}>
                {reportsError}
                <button type="button" className="button-quiet" onClick={() => void loadReports()}>
                  Retry
                </button>
              </div>
            )}

            {reportsLoading ? (
              <LoadingRows count={2} />
            ) : reports.length === 0 ? (
              <EmptyState
                title="No investigation reports yet"
                detail="Generate a report after running log or source-code analysis. Reports will be saved here."
              />
            ) : (
              <div style={{ display: 'grid', gap: 9 }}>
                {reports.map((report) => (
                  <div
                    key={report.id}
                    style={{
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650, overflowWrap: 'anywhere' }}>
                        {report.title}
                      </div>
                      <div className="timeline-time">
                        {formatDate(report.created_at)} · Report ID: {report.id}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => void openReport(report.id)}
                        disabled={reportDetailLoading}
                        data-testid={`button-view-report-${report.id}`}
                      >
                        {reportDetailLoading ? 'Loading…' : 'View details'}
                      </button>
                      <button
                        type="button"
                        className="button-quiet"
                        onClick={() => void exportReport(report.id, 'pdf')}
                        disabled={exportingReport !== null}
                        title="Download PDF"
                      >
                        <Download size={14} /> PDF
                      </button>
                      <button
                        type="button"
                        className="button-quiet"
                        onClick={() => void exportReport(report.id, 'json')}
                        disabled={exportingReport !== null}
                        title="Download JSON"
                      >
                        <Download size={14} /> JSON
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedReport && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border, #e5e7eb)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div className="panel-kicker">Selected report</div>
                    <h3 className="panel-title" style={{ marginTop: 5 }}>
                      {selectedReport.title}
                    </h3>
                    <div className="timeline-time">
                      Generated {formatDate(selectedReport.created_at)} · {selectedReport.report_data.analysis_count} analysis record(s)
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() => setSelectedReport(null)}
                  >
                    <XCircle size={14} /> Close
                  </button>
                </div>

                <div className="form-grid" style={{ marginTop: 14 }}>
                  {[
                    ['Issue ID', selectedReport.report_data.issue.id],
                    ['Severity', humanize(selectedReport.report_data.issue.severity)],
                    ['Status', humanize(selectedReport.report_data.issue.status)],
                    ['Service', selectedReport.report_data.issue.service],
                    ['Environment', selectedReport.report_data.issue.environment],
                    ['Assignee', selectedReport.report_data.issue.assignee || 'Unassigned'],
                  ].map(([label, value]) => (
                    <div key={label} className="detail-control">
                      <span className="detail-label">{label}</span>
                      <span className="detail-value">{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="form-label">Issue description</div>
                  <p className="detail-value" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
                    {selectedReport.report_data.issue.description || 'No description provided.'}
                  </p>
                </div>

                {selectedReport.report_data.issue.reproduction_steps && (
                  <div style={{ marginTop: 12 }}>
                    <div className="form-label">Reproduction steps</div>
                    <p className="detail-value" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
                      {selectedReport.report_data.issue.reproduction_steps}
                    </p>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <div className="form-label" style={{ marginBottom: 9 }}>Included analyses</div>
                  {selectedReport.report_data.analyses.length === 0 ? (
                    <div className="form-hint">No analysis records were available when this report was generated.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {selectedReport.report_data.analyses.map((analysis, index) => (
                        <div
                          key={analysis.analysis_id}
                          style={{
                            border: '1px solid var(--border, #e5e7eb)',
                            borderRadius: 9,
                            padding: 11,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <strong>{index + 1}. {humanize(analysis.analysis_type)}</strong>
                            <span className="timeline-time">{formatDate(analysis.created_at)}</span>
                          </div>
                          {analysis.result.filename && (
                            <div className="timeline-time" style={{ marginTop: 4 }}>
                              File: {analysis.result.filename}
                            </div>
                          )}
                          {analysis.result.summary && (
                            <div className="form-grid" style={{ marginTop: 10 }}>
                              {Object.entries(analysis.result.summary).map(([key, value]) => (
                                <div key={key} className="detail-control">
                                  <span className="detail-label">{humanize(key.replaceAll('_', ' '))}</span>
                                  <strong>{value}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                          {!!analysis.result.root_causes?.length && (
                            <div style={{ marginTop: 10 }}>
                              <div className="form-label">Possible root causes</div>
                              {analysis.result.root_causes.map((cause, causeIndex) => (
                                <div key={`${cause.category}-${causeIndex}`} style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'var(--surface-subtle, rgba(127,127,127,.07))' }}>
                                  <strong>{cause.category}</strong>
                                  <p style={{ margin: '5px 0', fontSize: 13 }}>{cause.explanation}</p>
                                  <p style={{ margin: 0, fontSize: 13 }}><strong>Recommendation:</strong> {cause.recommendation}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <details style={{ marginTop: 10 }}>
                            <summary className="form-label" style={{ cursor: 'pointer' }}>Full analysis data</summary>
                            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 320, overflow: 'auto', padding: 10, borderRadius: 8, background: 'var(--surface-subtle, rgba(127,127,127,.07))', fontSize: 11 }}>
                              {JSON.stringify(analysis.result, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: 'var(--surface-subtle, rgba(127,127,127,.07))', fontSize: 12 }}>
                  <strong>Analysis note:</strong> {selectedReport.report_data.analysis_note}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void exportReport(selectedReport.id, 'pdf')}
                    disabled={exportingReport !== null}
                  >
                    <Download size={14} /> {exportingReport === `${selectedReport.id}:pdf` ? 'Exporting…' : 'Export PDF'}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void exportReport(selectedReport.id, 'json')}
                    disabled={exportingReport !== null}
                  >
                    <Download size={14} /> {exportingReport === `${selectedReport.id}:json` ? 'Exporting…' : 'Export JSON'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border, #e5e7eb)' }}>
              <div className="panel-kicker" style={{ marginBottom: 8 }}>Investigation status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <select
                  className="field-select"
                  style={{ flex: '1 1 180px' }}
                  value={issue.status}
                  disabled={updatingStatus}
                  onChange={(event) => void updateInvestigationStatus(event.target.value as IssueStatus)}
                  data-testid="select-investigation-status"
                >
                  {statuses.map((item) => (
                    <option key={item} value={item}>{humanize(item)}</option>
                  ))}
                </select>
                {updatingStatus && <span className="form-hint">Updating status…</span>}
              </div>
            </div>
          </section>

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