import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import type { Issue } from '@workspace/api-client-react';
import { formatDate, humanize } from '@/lib/format';

export function IssueRow({ issue }: { issue: Issue }) {
  return <Link href={`/issues/${encodeURIComponent(issue.id)}`} className="issue-row" data-testid={`row-issue-${issue.id}`}>
    <div>
      <div className="issue-title">{issue.title}</div>
      <div className="issue-meta">{issue.service} <span style={{ margin: '0 5px', color: '#c2c8c4' }}>·</span> {issue.environment} <span style={{ margin: '0 5px', color: '#c2c8c4' }}>·</span> Updated {formatDate(issue.updated_at)}</div>
    </div>
    <span className={`severity-pill severity-${issue.severity}`}>{humanize(issue.severity)}</span>
    <span className={`status-pill status-${issue.status}`}>{humanize(issue.status)}</span>
    <span className="assignee">{issue.assignee || 'Unassigned'} <ChevronRight size={13} style={{ verticalAlign: 'middle', marginLeft: 5 }} /></span>
  </Link>;
}