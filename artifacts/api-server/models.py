from datetime import datetime
from enum import StrEnum
from pydantic import BaseModel, ConfigDict, Field

class IssueStatus(StrEnum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"

class IssueSeverity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Issue(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    id: str
    title: str
    description: str
    service: str
    environment: str
    severity: IssueSeverity
    status: IssueStatus
    assignee: str | None = None
    project_id: str | None = None
    created_at: datetime
    updated_at: datetime

class IssueInput(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    title: str = Field(min_length=3)
    description: str = Field(min_length=3)
    service: str = Field(min_length=1)
    environment: str = Field(min_length=1)
    severity: IssueSeverity
    status: IssueStatus = IssueStatus.OPEN
    assignee: str | None = None
    project_id: str | None = None


class IssueUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    title: str | None = Field(default=None, min_length=3)
    description: str | None = Field(default=None, min_length=3)
    service: str | None = Field(default=None, min_length=1)
    environment: str | None = Field(default=None, min_length=1)
    severity: IssueSeverity | None = None
    status: IssueStatus | None = None
    assignee: str | None = None
    project_id: str | None = None


class Activity(BaseModel):
    id: str
    issue_id: str
    issue_title: str
    action: str
    actor: str
    created_at: datetime


class DashboardSummary(BaseModel):
    total: int
    open: int
    investigating: int
    resolved: int
    critical: int