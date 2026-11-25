
import re
from pathlib import Path


ERROR_PATTERN = re.compile(
    r"\b(error|exception|fatal|critical|failed|failure)\b",
    re.IGNORECASE,
)

WARNING_PATTERN = re.compile(
    r"\b(warning|warn|deprecated)\b",
    re.IGNORECASE,
)

STACK_PATTERN = re.compile(
    r'File "([^"]+)", line (\d+)',
)

RULES = [
    (
        ["connection refused", "econnrefused"],
        "Connection Failure",
        "The application could not establish a connection to the target service.",
        "Check service availability, host, port and network configuration.",
    ),
    (
        ["connection timed out", "timeout", "timed out"],
        "Timeout",
        "An operation exceeded its allowed execution time.",
        "Check network latency, service response time and timeout settings.",
    ),
    (
        ["permission denied", "access is denied"],
        "Permission Error",
        "The application may not have sufficient access permissions.",
        "Review file, directory and service permissions.",
    ),
    (
        ["modulenotfounderror", "no module named", "importerror"],
        "Import Error",
        "A required module or dependency may be missing or incorrectly imported.",
        "Check installed dependencies and import paths.",
    ),
    (
        ["keyerror"],
        "Missing Dictionary Key",
        "The application attempted to access a dictionary key that does not exist.",
        "Validate dictionary keys before accessing them.",
    ),
    (
        ["typeerror"],
        "Type Error",
        "An operation may have received an unexpected data type.",
        "Inspect function arguments and variable types.",
    ),
    (
        ["attributeerror"],
        "Attribute Error",
        "The application attempted to access an unavailable object attribute.",
        "Check object initialization and attribute names.",
    ),
    (
        ["integrityerror", "uniqueviolation", "duplicate key"],
        "Database Integrity Error",
        "A database constraint may have been violated.",
        "Check duplicate records, unique constraints and foreign keys.",
    ),
    (
        ["operationalerror", "database is locked"],
        "Database Operational Error",
        "A database operation could not be completed.",
        "Check database connectivity, locks and query execution.",
    ),
    (
        ["syntaxerror", "indentationerror"],
        "Code Syntax Error",
        "The source code may contain invalid syntax or indentation.",
        "Inspect the reported file and line number.",
    ),
    (
        ["zerodivisionerror", "division by zero"],
        "Division by Zero",
        "A calculation attempted to divide by zero.",
        "Validate the denominator before performing division.",
    ),
    (
        ["filenotfounderror", "no such file or directory"],
        "File Not Found",
        "The application attempted to access a missing file or directory.",
        "Verify file paths and file availability.",
    ),
    (
        ["memoryerror", "out of memory"],
        "Memory Error",
        "The application may have exceeded available memory.",
        "Review memory consumption and large data operations.",
    ),
]


def analyze_log(content: str) -> dict:
    lines = content.splitlines()

    errors = []
    warnings = []
    stack_traces = []

    for line_number, line in enumerate(lines, start=1):
        if ERROR_PATTERN.search(line):
            errors.append({
                "line": line_number,
                "message": line.strip()[:1000],
            })

        if WARNING_PATTERN.search(line):
            warnings.append({
                "line": line_number,
                "message": line.strip()[:1000],
            })

        match = STACK_PATTERN.search(line)

        if match:
            stack_traces.append({
                "file": match.group(1),
                "line": int(match.group(2)),
                "log_line": line_number,
            })

    lower_content = content.lower()
    root_causes = []

    for keywords, title, explanation, recommendation in RULES:
        if any(keyword in lower_content for keyword in keywords):
            root_causes.append({
                "category": title,
                "explanation": explanation,
                "recommendation": recommendation,
                "confidence": "rule-based match",
            })

    if stack_traces:
        root_causes.append({
            "category": "Stack Trace Detected",
            "explanation": (
                "The log contains stack trace entries that may identify "
                "the location of an error."
            ),
            "recommendation": (
                "Inspect the reported files and lines to locate the "
                "origin of the exception."
            ),
            "confidence": "location detected, cause unconfirmed",
        })

    return {
        "summary": {
            "total_lines": len(lines),
            "error_count": len(errors),
            "warning_count": len(warnings),
            "stack_trace_count": len(stack_traces),
        },
        "errors": errors[:100],
        "warnings": warnings[:100],
        "stack_traces": stack_traces[:100],
        "root_causes": root_causes,
        "analysis_method": "Rule-based pattern matching",
        "limitations": (
            "Results are suggestions based on log patterns. "
            "They do not prove the actual root cause."
        ),
    }
