from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Response, status

from models import (
    Activity,
    DashboardSummary,
    Issue,
    IssueInput,
    IssueSeverity,
    IssueStatus,
    IssueUpdate,
)
from store import ACTIVITY, ISSUES, record_activity

app = FastAPI(
    title="TraceRoot API",
    description="Issue tracking and root-cause investigation API for TraceRoot.",
    version="0.1.0",
)


@app.get("/api/healthz", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/issues", response_model=list[Issue], tags=["issues"])
def list_issues(
    status_filter: IssueStatus | None = Query(default=None, alias="status"),
    severity: IssueSeverity | None = None,
    search: str | None = None,
) -> list[Issue]:
    issues = list(ISSUES.values())
    if status_filter is not None:
        issues = [issue for issue in issues if issue.status == status_filter]
    if severity is not None:
        issues = [issue for issue in issues if issue.severity == severity]
    if search:
        needle = search.casefold().strip()
        issues = [
            issue
            for issue in issues
            if needle
            in " ".join(
                [
                    issue.id,
                    issue.title,
                    issue.description,
                    issue.service,
                    issue.environment,
                    issue.assignee or "",
                ]
            ).casefold()
        ]
    return sorted(issues, key=lambda issue: issue.updated_at, reverse=True)


@app.post(
    "/api/issues",
    response_model=Issue,
    status_code=status.HTTP_201_CREATED,
    tags=["issues"],
)
def create_issue(payload: IssueInput) -> Issue:
    now = datetime.now(timezone.utc)
    issue = Issue(
        id=f"TR-{str(uuid4()).split('-')[0].upper()}",
        **payload.model_dump(),
        created_at=now,
        updated_at=now,
    )
    ISSUES[issue.id] = issue
    record_activity(issue, "Issue created")
    return issue


@app.get("/api/issues/{issue_id}", response_model=Issue, tags=["issues"])
def get_issue(issue_id: str) -> Issue:
    issue = ISSUES.get(issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@app.patch("/api/issues/{issue_id}", response_model=Issue, tags=["issues"])
def update_issue(issue_id: str, payload: IssueUpdate) -> Issue:
    issue = ISSUES.get(issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return issue

    previous_status = issue.status
    updated = issue.model_copy(
        update={**changes, "updated_at": datetime.now(timezone.utc)}
    )
    ISSUES[issue_id] = updated

    if updated.status != previous_status:
        action = f"Status changed to {updated.status}"
    elif "assignee" in changes:
        action = (
            f"Assigned to {updated.assignee}"
            if updated.assignee
            else "Assignee removed"
        )
    else:
        action = "Issue details updated"
    record_activity(updated, action)
    return updated


@app.delete(
    "/api/issues/{issue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["issues"],
)
def delete_issue(issue_id: str) -> Response:
    issue = ISSUES.pop(issue_id, None)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    ACTIVITY[:] = [event for event in ACTIVITY if event.issue_id != issue_id]
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(
    "/api/dashboard/summary",
    response_model=DashboardSummary,
    tags=["dashboard"],
)
def get_dashboard_summary() -> DashboardSummary:
    issues = list(ISSUES.values())
    return DashboardSummary(
        total=len(issues),
        open=sum(issue.status == IssueStatus.OPEN for issue in issues),
        investigating=sum(
            issue.status == IssueStatus.INVESTIGATING for issue in issues
        ),
        resolved=sum(issue.status == IssueStatus.RESOLVED for issue in issues),
        critical=sum(issue.severity == IssueSeverity.CRITICAL for issue in issues),
    )


@app.get("/api/activity", response_model=list[Activity], tags=["dashboard"])
def list_activity(
    limit: int = Query(default=8, ge=1, le=50),
) -> list[Activity]:
    return ACTIVITY[:limit]