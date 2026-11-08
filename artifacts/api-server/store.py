from datetime import datetime, timedelta, timezone
from models import Activity, Issue, IssueSeverity, IssueStatus

now = datetime.now(timezone.utc)

ISSUES: dict[str, Issue] = {
    "TR-1048": Issue(
        id="TR-1048",
        title="Checkout API returns 502 after gateway timeout",
        description="A spike in checkout traffic leaves requests waiting past the gateway timeout. Retries appear to increase database connection pressure.",
        service="checkout-api",
        environment="production",
        severity=IssueSeverity.CRITICAL,
        status=IssueStatus.INVESTIGATING,
        assignee="Maya Chen",
        created_at=now - timedelta(minutes=38),
        updated_at=now - timedelta(minutes=8),
    ),
    "TR-1047": Issue(
        id="TR-1047",
        title="Worker retries duplicate invoice emails",
        description="The invoice worker can pick up the same message twice when an acknowledgement arrives after the visibility timeout.",
        service="billing-worker",
        environment="production",
        severity=IssueSeverity.HIGH,
        status=IssueStatus.OPEN,
        assignee="Noah Williams",
        created_at=now - timedelta(hours=2, minutes=14),
        updated_at=now - timedelta(hours=1, minutes=48),
    ),
    "TR-1046": Issue(
        id="TR-1046",
        title="Search results missing newly indexed records",
        description="Records created during the last deploy are visible in the primary store but take several minutes to appear in search.",
        service="search-indexer",
        environment="staging",
        severity=IssueSeverity.MEDIUM,
        status=IssueStatus.INVESTIGATING,
        assignee="Alex Rivera",
        created_at=now - timedelta(hours=5, minutes=22),
        updated_at=now - timedelta(minutes=52),
    ),
    "TR-1045": Issue(
        id="TR-1045",
        title="Session refresh fails for Safari users",
        description="A cookie attribute change prevents the refresh token from being sent on a cross-site navigation in Safari.",
        service="identity-gateway",
        environment="production",
        severity=IssueSeverity.LOW,
        status=IssueStatus.RESOLVED,
        assignee="Jamie Park",
        created_at=now - timedelta(days=1, hours=3),
        updated_at=now - timedelta(hours=4),
    ),
}

ACTIVITY: list[Activity] = [
    Activity(
        id="ACT-4",
        issue_id="TR-1048",
        issue_title=ISSUES["TR-1048"].title,
        action="Investigation started",
        actor="Maya Chen",
        created_at=now - timedelta(minutes=8),
    ),
    Activity(
        id="ACT-3",
        issue_id="TR-1046",
        issue_title=ISSUES["TR-1046"].title,
        action="Root cause narrowed to index queue lag",
        actor="Alex Rivera",
        created_at=now - timedelta(minutes=52),
    ),
    Activity(
        id="ACT-2",
        issue_id="TR-1047",
        issue_title=ISSUES["TR-1047"].title,
        action="Issue assigned to Noah Williams",
        actor="You",
        created_at=now - timedelta(hours=1, minutes=48),
    ),
    Activity(
        id="ACT-1",
        issue_id="TR-1045",
        issue_title=ISSUES["TR-1045"].title,
        action="Issue marked resolved",
        actor="Jamie Park",
        created_at=now - timedelta(hours=4),
    ),
]


def record_activity(issue: Issue, action: str, actor: str = "You") -> None:
    ACTIVITY.insert(
        0,
        Activity(
            id=f"ACT-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            issue_id=issue.id,
            issue_title=issue.title,
            action=action,
            actor=actor,
            created_at=datetime.now(timezone.utc),
        ),
    )