import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def generate_id():
    return str(uuid.uuid4())


def current_time():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time, nullable=False
    )

    projects: Mapped[list["Project"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    issues: Mapped[list["IssueRecord"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time,
        nullable=False,
    )

    owner: Mapped["User"] = relationship(back_populates="projects")

    issues: Mapped[list["IssueRecord"]] = relationship(
        back_populates="project",
        passive_deletes=True,
    )


class IssueRecord(Base):
    __tablename__ = "issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    service: Mapped[str] = mapped_column(String(150), nullable=False)
    environment: Mapped[str] = mapped_column(String(100), nullable=False)

    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)

    assignee: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )

    owner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    project_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time, nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time,
        nullable=False,
    )

    reproduction_steps: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )

    evidence_files: Mapped[list["EvidenceRecord"]] = relationship(
        back_populates="issue",
        cascade="all, delete-orphan",
    )
    owner: Mapped["User"] = relationship(back_populates="issues")

    analysis_records: Mapped[list["AnalysisRecord"]] = relationship(
        back_populates="issue",
        cascade="all, delete-orphan",
    )

    reports: Mapped[list["InvestigationReport"]] = relationship(
        back_populates="issue",
        cascade="all, delete-orphan",
    )

    project: Mapped["Project | None"] = relationship(
        back_populates="issues"
    )

    activities: Mapped[list["ActivityRecord"]] = relationship(
        back_populates="issue",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class EvidenceRecord(Base):
    __tablename__ = "evidence_files"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_id,
    )

    issue_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("issues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    stored_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
    )

    storage_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    content_type: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )

    issue: Mapped["IssueRecord"] = relationship(
        back_populates="evidence_files",
    )

class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )

    issue_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("issues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    evidence_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("evidence_files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    analysis_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    result: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )

    issue: Mapped["IssueRecord"] = relationship(
        back_populates="analysis_records"
    )

class InvestigationReport(Base):
    __tablename__ = "investigation_reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )

    issue_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("issues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    report_data: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time,
        nullable=False,
    )

    issue: Mapped["IssueRecord"] = relationship(
        back_populates="reports"
    )


class ActivityRecord(Base):
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)

    issue_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("issues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    issue_title: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    actor: Mapped[str] = mapped_column(String(150), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time, nullable=False
    )

    issue: Mapped["IssueRecord"] = relationship(
        back_populates="activities"
    )
