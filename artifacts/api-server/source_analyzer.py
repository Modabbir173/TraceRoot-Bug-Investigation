
import ast
import io
import zipfile
from pathlib import PurePosixPath

MAX_ZIP_SIZE = 25 * 1024 * 1024
MAX_EXTRACTED_SIZE = 50 * 1024 * 1024
MAX_FILES = 500
MAX_FILE_SIZE = 2 * 1024 * 1024

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".java", ".go", ".php", ".cs", ".cpp", ".c"
}


def analyze_source_zip(zip_content: bytes, stack_traces=None) -> dict:
    if len(zip_content) > MAX_ZIP_SIZE:
        raise ValueError("ZIP file exceeds 25 MB limit.")

    if not zipfile.is_zipfile(io.BytesIO(zip_content)):
        raise ValueError("Invalid ZIP file.")

    stack_traces = stack_traces or []

    source_files = []
    matched_files = []
    skipped_files = []
    total_size = 0

    with zipfile.ZipFile(io.BytesIO(zip_content)) as archive:
        entries = archive.infolist()

        if len(entries) > MAX_FILES:
            raise ValueError("ZIP contains too many files.")

        for entry in entries:
            if entry.is_dir():
                continue

            path = PurePosixPath(entry.filename)

            if (
                path.is_absolute()
                or ".." in path.parts
                or "\\" in entry.filename
            ):
                skipped_files.append(entry.filename)
                continue

            if entry.file_size > MAX_FILE_SIZE:
                skipped_files.append(entry.filename)
                continue

            total_size += entry.file_size

            if total_size > MAX_EXTRACTED_SIZE:
                raise ValueError("Extracted content exceeds 50 MB.")

            if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue

            try:
                content = archive.read(entry).decode("utf-8-sig")
            except (UnicodeDecodeError, RuntimeError):
                skipped_files.append(entry.filename)
                continue

            lines = content.splitlines()

            item = {
                "file": entry.filename,
                "extension": path.suffix.lower(),
                "line_count": len(lines),
                "size": entry.file_size,
            }

            source_files.append(item)

            for trace in stack_traces:
                trace_file = PurePosixPath(
                    str(trace.get("file", "")).replace("\\", "/")
                ).as_posix()

                if (
                    trace_file
                    and (
                        entry.filename == trace_file
                        or entry.filename.endswith("/" + trace_file)
                        or trace_file.endswith("/" + entry.filename)
                    )
                ):
                    line_number = trace.get("line")

                    matched_files.append({
                        "file": entry.filename,
                        "line": line_number,
                        "line_content": (
                            lines[line_number - 1].strip()[:500]
                            if isinstance(line_number, int)
                            and 1 <= line_number <= len(lines)
                            else None
                        ),
                        "match_type": "stack trace path match",
                    })

    return {
        "summary": {
            "source_files_found": len(source_files),
            "matched_files": len(matched_files),
            "skipped_files": len(skipped_files),
        },
        "source_files": source_files[:200],
        "problematic_files": matched_files[:100],
        "skipped_files": skipped_files[:100],
        "analysis_method": "ZIP source inspection and stack trace matching",
        "limitations": (
            "File matching identifies locations referenced by stack traces. "
            "It does not prove that a file contains the root cause."
        ),
    }
