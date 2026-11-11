
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Response, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database import get_db
from db_models import User, Project, IssueRecord, ActivityRecord
from auth import router as auth_router, get_current_user
from projects import router as projects_router

from models import (
    Activity,
    DashboardSummary,
    Issue,
    IssueInput,
    IssueSeverity,
    IssueStatus,
    IssueUpdate,
)

from fastapi import Depends


app = FastAPI(
    title="TraceRoot API",
    description="Issue tracking and root-cause investigation API for TraceRoot.",
    version="0.2.0",
)

app.include_router(auth_router)
app.include_router(projects_router)


@app.get("/api/healthz", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


def get_owned_project(
    project_id: str,
    user_id: str,
    db: Session,
) -> Project:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Projects not found",
        )

    return project


def get_owned_issue(
    issue_id: str,
    user_id: str,
    db: Session,
) -> IssueRecord:
    issue = db.scalar(
        select(IssueRecord).where(
            IssueRecord.id == issue_id,
            IssueRecord.owner_id == user_id,
        )
    )

    if issue is None:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return issue


def create_activity(
    db: Session,
    issue: IssueRecord,
    action: str,
    actor: str,
) -> None:
    activity = ActivityRecord(
        id=f"ACT-{uuid4().hex[:12].upper()}",
        issue_id=issue.id,
        issue_title=issue.title,
        action=action,
        actor=actor,
        created_at=datetime.now(timezone.utc),
    )

    db.add(activity)


def issue_response(issue: IssueRecord) -> Issue:
    return Issue(
        id=issue.id,
        title=issue.title,
        description=issue.description,
        service=issue.service,
        environment=issue.environment,
        severity=issue.severity,
        status=issue.status,
        assignee=issue.assignee,
        project_id=issue.project_id,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
    )


@app.get("/api/issues", response_model=list[Issue], tags=["issues"])
def list_issues(
    status_filter: IssueStatus | None = Query(default=None, alias="status"),
    severity: IssueSeverity | None = None,
    search: str | None = None,
    project_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Issue]:

    statement = select(IssueRecord).where(
        IssueRecord.owner_id == current_user.id
    )

    if status_filter is not None:
        statement = statement.where(
            IssueRecord.status == status_filter.value
        )

    if severity is not None:
        statement = statement.where(
            IssueRecord.severity == severity.value
        )

    if project_id is not None:
        statement = statement.where(
            IssueRecord.project_id == project_id
        )

    if search:
        needle = f"%{search.strip()}%"
        statement = statement.where(
            IssueRecord.title.ilike(needle)
            | IssueRecord.description.ilike(needle)
            | IssueRecord.service.ilike(needle)
            | IssueRecord.environment.ilike(needle)
        )

    statement = statement.order_by(IssueRecord.updated_at.desc())

    records = db.scalars(statement).all()

    return [issue_response(record) for record in records]


@app.post(
    "/api/issues",
    response_model=Issue,
    status_code=status.HTTP_201_CREATED,
    tags=["issues"],
)
def create_issue(
    payload: IssueInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Issue:

    if payload.project_id:
        get_owned_project(payload.project_id, current_user.id, db)

    now = datetime.now(timezone.utc)

    issue = IssueRecord(
        id=f"TR-{uuid4().hex[:8].upper()}",
        **payload.model_dump(),
        owner_id=current_user.id,
        created_at=now,
        updated_at=now,
    )

    db.add(issue)

    create_activity(
        db,
        issue,
        "Issue created",
        current_user.full_name,
    )

    db.commit()
    db.refresh(issue)

    return issue_response(issue)


@app.get(
    "/api/issues/{issue_id}",
    response_model=Issue,
    tags=["issues"],
)
def get_issue(
    issue_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Issue:

    issue = get_owned_issue(issue_id, current_user.id, db)

    return issue_response(issue)


@app.patch(
    "/api/issues/{issue_id}",
    response_model=Issue,
    tags=["issues"],
)
def update_issue(
    issue_id: str,
    payload: IssueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Issue:

    issue = get_owned_issue(issue_id, current_user.id, db)

    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        return issue_response(issue)

    if "project_id" in changes and changes["project_id"] is not None:
        get_owned_project(changes["project_id"], current_user.id, db)

    previous_status = issue.status
    previous_assignee = issue.assignee

    for field, value in changes.items():
        setattr(issue, field, value)

    issue.updated_at = datetime.now(timezone.utc)

    if issue.status != previous_status:
        action = f"Status changed to {issue.status}"
    elif issue.assignee != previous_assignee:
        action = (
            f"Assigned to {issue.assignee}"
            if issue.assignee
            else "Assignee removed"
        )
    elif "project_id" in changes:
        action = (
            "Issue associated with a project"
            if issue.project_id
            else "Issue removed from project"
        )
    else:
        action = "Issue details updated"

    create_activity(
        db,
        issue,
        action,
        current_user.full_name,
    )

    db.commit()
    db.refresh(issue)

    return issue_response(issue)


@app.delete(
    "/api/issues/{issue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["issues"],
)
def delete_issue(
    issue_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    db.delete(issue)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(
    "/api/dashboard/summary",
    response_model=DashboardSummary,
    tags=["dashboard"],
)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:

    base_query = select(IssueRecord).where(
        IssueRecord.owner_id == current_user.id
    )

    issues = db.scalars(base_query).all()

    return DashboardSummary(
        total=len(issues),
        open=sum(issue.status == IssueStatus.OPEN.value for issue in issues),
        investigating=sum(
            issue.status == IssueStatus.INVESTIGATING.value
            for issue in issues
        ),
        resolved=sum(
            issue.status == IssueStatus.RESOLVED.value
            for issue in issues
        ),
        critical=sum(
            issue.severity == IssueSeverity.CRITICAL.value
            for issue in issues
        ),
    )


@app.get(
    "/api/activity",
    response_model=list[Activity],
    tags=["dashboard"],
)
def list_activity(
    limit: int = Query(default=8, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Activity]:

    statement = (
        select(ActivityRecord)
        .join(IssueRecord)
        .where(IssueRecord.owner_id == current_user.id)
        .order_by(ActivityRecord.created_at.desc())
        .limit(limit)
    )

    records = db.scalars(statement).all()

    return [
        Activity(
            id=record.id,
            issue_id=record.issue_id,
            issue_title=record.issue_title,
            action=record.action,
            actor=record.actor,
            created_at=record.created_at,
        )
        for record in records
    ]
