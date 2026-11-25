import os
import json
from io import BytesIO
from html import escape
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    Response,
    status,
    Form,
    UploadFile,
    File,
    Depends,
)
from fastapi.responses import FileResponse, StreamingResponse

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Preformatted,
)

from database import get_db

from db_models import (
    User,
    Project,
    IssueRecord,
    ActivityRecord,
    EvidenceRecord,
    AnalysisRecord,
    InvestigationReport,
)

from auth import router as auth_router, get_current_user
from projects import router as projects_router
from log_analyzer import analyze_log
from source_analyzer import analyze_source_zip

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
        reproduction_steps=issue.reproduction_steps,
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

# =========================
# Evidence Management
# =========================

EVIDENCE_DIR = Path(__file__).resolve().parent / "uploads" / "evidence"
ALLOWED_EXTENSIONS = {".log", ".txt", ".json"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@app.post(
    "/api/issues/{issue_id}/evidence",
    status_code=status.HTTP_201_CREATED,
    tags=["evidence"],
)
async def upload_evidence(
    issue_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    original_filename = (file.filename or "evidence").replace("\\", "/")
    original_filename = original_filename.split("/")[-1]
    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only .log, .txt and .json files are allowed.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if not content:
        raise HTTPException(status_code=400, detail="File is empty.")

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 10 MB limit.",
        )

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid4().hex}{extension}"
    storage_path = EVIDENCE_DIR / stored_filename

    try:
        storage_path.write_bytes(content)

        evidence = EvidenceRecord(
            issue_id=issue.id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            storage_path=str(storage_path),
            content_type=file.content_type or "application/octet-stream",
            file_size=len(content),
            uploaded_at=datetime.now(timezone.utc),
        )

        db.add(evidence)
        db.commit()
        db.refresh(evidence)

    except Exception:
        db.rollback()
        storage_path.unlink(missing_ok=True)
        raise

    return {
        "id": evidence.id,
        "issue_id": evidence.issue_id,
        "original_filename": evidence.original_filename,
        "content_type": evidence.content_type,
        "file_size": evidence.file_size,
        "uploaded_at": evidence.uploaded_at,
    }


@app.get(
    "/api/issues/{issue_id}/evidence",
    tags=["evidence"],
)
def list_evidence(
    issue_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    records = db.scalars(
        select(EvidenceRecord)
        .where(EvidenceRecord.issue_id == issue.id)
        .order_by(EvidenceRecord.uploaded_at.desc())
    ).all()

    return [
        {
            "id": item.id,
            "issue_id": item.issue_id,
            "original_filename": item.original_filename,
            "content_type": item.content_type,
            "file_size": item.file_size,
            "uploaded_at": item.uploaded_at,
        }
        for item in records
    ]


@app.get(
    "/api/issues/{issue_id}/evidence/{evidence_id}",
    tags=["evidence"],
)
def download_evidence(
    issue_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    evidence = db.scalar(
        select(EvidenceRecord).where(
            EvidenceRecord.id == evidence_id,
            EvidenceRecord.issue_id == issue.id,
        )
    )

    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found.")

    storage_path = Path(evidence.storage_path)

    if not storage_path.is_file():
        raise HTTPException(status_code=404, detail="Evidence file not found.")

    return FileResponse(
        path=storage_path,
        filename=evidence.original_filename,
        media_type="application/octet-stream",
    )


@app.delete(
    "/api/issues/{issue_id}/evidence/{evidence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["evidence"],
)
def delete_evidence(
    issue_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    evidence = db.scalar(
        select(EvidenceRecord).where(
            EvidenceRecord.id == evidence_id,
            EvidenceRecord.issue_id == issue.id,
        )
    )

    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found.")

    storage_path = Path(evidence.storage_path)

    db.delete(evidence)
    db.commit()

    storage_path.unlink(missing_ok=True)

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post(
    "/api/issues/{issue_id}/evidence/{evidence_id}/analyze",
    tags=["analysis"],
)
def analyze_evidence(
    issue_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    evidence = db.scalar(
        select(EvidenceRecord).where(
            EvidenceRecord.id == evidence_id,
            EvidenceRecord.issue_id == issue.id,
        )
    )

    if evidence is None:
        raise HTTPException(404, "Evidence not found.")

    if Path(evidence.original_filename).suffix.lower() not in {
        ".log", ".txt", ".json"
    }:
        raise HTTPException(400, "Unsupported evidence format.")

    path = Path(evidence.storage_path)

    if not path.is_file():
        raise HTTPException(404, "Evidence file not found.")

    try:
        content = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must contain valid UTF-8 text.")

    result = {
        "issue_id": issue.id,
        "evidence_id": evidence.id,
        "filename": evidence.original_filename,
        **analyze_log(content),
    }

    record = AnalysisRecord(
        issue_id=issue.id,
        evidence_id=evidence.id,
        analysis_type="log_analysis",
        result=json.dumps(result, ensure_ascii=False),
    )

    db.add(record)
    db.commit()

    result["analysis_id"] = record.id
    return result


# =========================
# Source Code ZIP Analysis
# =========================

SOURCE_ZIP_MAX_SIZE = 25 * 1024 * 1024  # 25 MB


@app.post(
    "/api/issues/{issue_id}/source-code",
    status_code=status.HTTP_201_CREATED,
    tags=["source-analysis"],
)
async def upload_source_code(
    issue_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    filename = (file.filename or "").replace("\\", "/").split("/")[-1]

    if not filename.lower().endswith(".zip"):
        raise HTTPException(400, "Only ZIP source code files are allowed.")

    content = await file.read(SOURCE_ZIP_MAX_SIZE + 1)
    await file.close()

    if not content:
        raise HTTPException(400, "ZIP file is empty.")

    if len(content) > SOURCE_ZIP_MAX_SIZE:
        raise HTTPException(413, "ZIP file exceeds 25 MB.")

    import io
    import zipfile

    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise HTTPException(400, "Invalid ZIP archive.")

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid4().hex}.zip"
    storage_path = EVIDENCE_DIR / stored_filename

    try:
        storage_path.write_bytes(content)

        evidence = EvidenceRecord(
            issue_id=issue.id,
            original_filename=filename,
            stored_filename=stored_filename,
            storage_path=str(storage_path),
            content_type="application/zip",
            file_size=len(content),
            uploaded_at=datetime.now(timezone.utc),
        )

        db.add(evidence)
        db.commit()
        db.refresh(evidence)

    except Exception:
        db.rollback()
        storage_path.unlink(missing_ok=True)
        raise

    return {
        "message": "Source code ZIP uploaded successfully.",
        "id": evidence.id,
        "issue_id": issue.id,
        "filename": evidence.original_filename,
        "file_size": evidence.file_size,
    }


@app.post(
    "/api/issues/{issue_id}/source-code/{evidence_id}/analyze",
    tags=["source-analysis"],
)
def analyze_source_code(
    issue_id: str,
    evidence_id: str,
    stack_traces: str = Form(default="[]"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    evidence = db.scalar(
        select(EvidenceRecord).where(
            EvidenceRecord.id == evidence_id,
            EvidenceRecord.issue_id == issue.id,
        )
    )

    if evidence is None:
        raise HTTPException(404, "Source code file not found.")

    if not evidence.original_filename.lower().endswith(".zip"):
        raise HTTPException(400, "Evidence is not a source code ZIP file.")

    path = Path(evidence.storage_path)

    if not path.is_file():
        raise HTTPException(404, "Source code ZIP file is missing.")

    try:
        traces = json.loads(stack_traces)

        if not isinstance(traces, list) or not all(
            isinstance(item, dict) for item in traces
        ):
            raise ValueError("Stack traces must be a JSON array of objects.")

        if len(traces) > 100:
            raise ValueError("Maximum 100 stack trace entries allowed.")

        result = analyze_source_zip(
            path.read_bytes(),
            stack_traces=traces,
        )

    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(400, str(exc))

    analysis_result = {
        "issue_id": issue.id,
        "evidence_id": evidence.id,
        "filename": evidence.original_filename,
        **result,
    }

    record = AnalysisRecord(
        issue_id=issue.id,
        evidence_id=evidence.id,
        analysis_type="source_code_analysis",
        result=json.dumps(analysis_result, ensure_ascii=False),
    )

    db.add(record)
    db.commit()

    analysis_result["analysis_id"] = record.id
    return analysis_result


# =====================================
# Module 3: Investigation Report APIs
# =====================================


def get_owned_report(
    report_id: str,
    user_id: str,
    db: Session,
) -> InvestigationReport:
    report = db.scalar(
        select(InvestigationReport)
        .join(IssueRecord)
        .where(
            InvestigationReport.id == report_id,
            IssueRecord.owner_id == user_id,
        )
    )

    if report is None:
        raise HTTPException(404, "Report not found.")

    return report


def report_response(report: InvestigationReport) -> dict:
    return {
        "id": report.id,
        "issue_id": report.issue_id,
        "title": report.title,
        "report_data": json.loads(report.report_data),
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


# 1. Generate Report

@app.post(
    "/api/issues/{issue_id}/reports",
    status_code=status.HTTP_201_CREATED,
    tags=["reports"],
)
def generate_report(
    issue_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    analyses = db.scalars(
        select(AnalysisRecord)
        .where(AnalysisRecord.issue_id == issue.id)
        .order_by(AnalysisRecord.created_at.desc())
    ).all()

    analysis_results = []

    for analysis in analyses:
        analysis_results.append({
            "analysis_id": analysis.id,
            "analysis_type": analysis.analysis_type,
            "evidence_id": analysis.evidence_id,
            "created_at": analysis.created_at.isoformat(),
            "result": json.loads(analysis.result),
        })

    report_data = {
        "issue": {
            "id": issue.id,
            "title": issue.title,
            "description": issue.description,
            "reproduction_steps": issue.reproduction_steps,
            "service": issue.service,
            "environment": issue.environment,
            "severity": issue.severity,
            "status": issue.status,
            "assignee": issue.assignee,
            "created_at": issue.created_at.isoformat(),
            "updated_at": issue.updated_at.isoformat(),
        },
        "analysis_count": len(analysis_results),
        "analyses": analysis_results,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "analysis_note": (
            "Root cause suggestions are rule-based findings "
            "and require developer verification."
        ),
    }

    report = InvestigationReport(
        issue_id=issue.id,
        title=f"Investigation Report - {issue.title}",
        report_data=json.dumps(report_data, ensure_ascii=False),
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return report_response(report)


# 2. List Reports + Search + Filter

@app.get(
    "/api/reports",
    tags=["reports"],
)
def list_reports(
    search: str | None = Query(default=None),
    issue_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(InvestigationReport)
        .join(IssueRecord)
        .where(IssueRecord.owner_id == current_user.id)
    )

    if issue_id:
        statement = statement.where(
            InvestigationReport.issue_id == issue_id
        )

    if search:
        needle = f"%{search.strip()}%"
        statement = statement.where(
            InvestigationReport.title.ilike(needle)
            | IssueRecord.title.ilike(needle)
        )

    statement = statement.order_by(
        InvestigationReport.created_at.desc()
    )

    reports = db.scalars(statement).all()

    return [
        {
            "id": report.id,
            "issue_id": report.issue_id,
            "title": report.title,
            "created_at": report.created_at,
            "updated_at": report.updated_at,
        }
        for report in reports
    ]


# 3. Report Details

@app.get(
    "/api/reports/{report_id}",
    tags=["reports"],
)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = get_owned_report(report_id, current_user.id, db)
    return report_response(report)


# 4. Update Investigation Status

@app.patch(
    "/api/issues/{issue_id}/status",
    tags=["reports"],
)
def update_investigation_status(
    issue_id: str,
    new_status: IssueStatus = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = get_owned_issue(issue_id, current_user.id, db)

    old_status = issue.status
    issue.status = new_status.value
    issue.updated_at = datetime.now(timezone.utc)

    if old_status != issue.status:
        create_activity(
            db,
            issue,
            f"Status changed to {issue.status}",
            current_user.full_name,
        )

    db.commit()
    db.refresh(issue)

    return {
        "issue_id": issue.id,
        "old_status": old_status,
        "new_status": issue.status,
        "message": "Investigation status updated.",
    }


# 5. Export Report: JSON / PDF

@app.get(
    "/api/reports/{report_id}/export",
    tags=["reports"],
)
def export_report(
    report_id: str,
    format: str = Query(default="json", pattern="^(json|pdf)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = get_owned_report(report_id, current_user.id, db)
    data = report_response(report)

    if format == "json":
        content = json.dumps(
            data,
            indent=2,
            ensure_ascii=False,
            default=str,
        ).encode("utf-8")

        return StreamingResponse(
            BytesIO(content),
            media_type="application/json",
            headers={
                "Content-Disposition":
                    f'attachment; filename="TraceRoot-{report.id}.json"'
            },
        )

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        spaceAfter=15,
    )

    section_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#176B87"),
        spaceBefore=12,
        spaceAfter=7,
    )

    body_style = styles["BodyText"]

    story = []

    story.append(Paragraph("TraceRoot Investigation Report", title_style))
    story.append(Paragraph(escape(report.title), styles["Heading2"]))
    story.append(Spacer(1, 10))

    issue_data = data["report_data"]["issue"]

    story.append(Paragraph("Bug Information", section_style))

    fields = [
        ("Issue ID", issue_data["id"]),
        ("Title", issue_data["title"]),
        ("Severity", issue_data["severity"]),
        ("Status", issue_data["status"]),
        ("Service", issue_data["service"]),
        ("Environment", issue_data["environment"]),
        ("Assignee", issue_data["assignee"] or "Unassigned"),
        ("Description", issue_data["description"]),
        ("Reproduction Steps", issue_data["reproduction_steps"] or "Not provided"),
    ]

    for label, value in fields:
        story.append(
            Paragraph(
                f"<b>{escape(str(label))}:</b> "
                f"{escape(str(value)).replace(chr(10), '<br/>')}",
                body_style,
            )
        )
        story.append(Spacer(1, 5))

    story.append(Paragraph("Analysis Results", section_style))

    for index, analysis in enumerate(
        data["report_data"]["analyses"], start=1
    ):
        story.append(
            Paragraph(
                f"Analysis {index}: {escape(analysis['analysis_type'])}",
                styles["Heading3"],
            )
        )

        formatted = json.dumps(
            analysis["result"],
            indent=2,
            ensure_ascii=False,
            default=str,
        )

        story.append(
            Preformatted(
                formatted,
                ParagraphStyle(
                    f"AnalysisCode{index}",
                    parent=styles["Code"],
                    fontSize=7,
                    leading=9,
                    wordWrap="CJK",
                ),
            )
        )

    story.append(Spacer(1, 15))
    story.append(
        Paragraph(
            escape(data["report_data"]["analysis_note"]),
            body_style,
        )
    )

    document.build(story)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'attachment; filename="TraceRoot-{report.id}.pdf"'
        },
    )
