import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import type { Issue } from '@workspace/api-client-react';
import { formatDate, humanize } from '@/lib/format';

type IssueWithProject = Issue & {
  project_id?: string | null;
};

export function IssueRow({
  issue,
  projectName,
}: {
  issue: IssueWithProject;
  projectName?: string;
}) {
  return (
    <Link
      href={`/issues/${encodeURIComponent(issue.id)}`}
      className="issue-row"
      data-testid={`row-issue-${issue.id}`}
      style={{
        display: 'grid',
        gridTemplateColumns:
          'minmax(180px, 2fr) minmax(120px, 1fr) minmax(80px, 0.7fr) minmax(90px, 0.8fr) minmax(100px, 1fr)',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="issue-title">{issue.title}</div>

        <div className="issue-meta">
          {issue.service}
          <span style={{ margin: '0 5px', color: '#c2c8c4' }}>·</span>
          {issue.environment}
          <span style={{ margin: '0 5px', color: '#c2c8c4' }}>·</span>
          Updated {formatDate(issue.updated_at)}
        </div>
      </div>

      <span
        style={{
          fontSize: 12,
          overflowWrap: 'anywhere',
          opacity: 0.85,
        }}
      >
        {projectName || 'Unassigned'}
      </span>

      <span className={`severity-pill severity-${issue.severity}`}>
        {humanize(issue.severity)}
      </span>

      <span className={`status-pill status-${issue.status}`}>
        {humanize(issue.status)}
      </span>

      <span className="assignee">
        {issue.assignee || 'Unassigned'}
        <ChevronRight
          size={13}
          style={{ verticalAlign: 'middle', marginLeft: 5 }}
        />
      </span>
    </Link>
  );
}