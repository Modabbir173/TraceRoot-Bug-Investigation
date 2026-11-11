
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import {
    Plus,
    Search,
    X,
    FolderKanban,
    Pencil,
    Trash2,
    CalendarDays,
    Bug,
    ExternalLink,
} from 'lucide-react';
import { EmptyState, ErrorState, PageHeading, useNotice } from '@/components/app-shell';
import { errorMessage, formatDate, humanize } from '@/lib/format';
import {
    listProjects,
    listProjectIssues,
    createProject,
    updateProject,
    deleteProject,
    type Projects,
    type ProjectIssue,
} from '@/lib/projects';

const emptyForm = {
    name: '',
    description: '',
};

export default function Projects() {
    const [projects, setProjects] = useState<Projects[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Projects | null>(null);
    const [selectedProject, setSelectedProject] = useState<Projects | null>(null);

    const [associatedIssues, setAssociatedIssues] = useState<ProjectIssue[]>([]);
    const [issuesLoading, setIssuesLoading] = useState(false);
    const [issuesError, setIssuesError] = useState('');

    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const notify = useNotice();

    async function loadProjects() {
        setIsLoading(true);
        setLoadError(null);

        try {
            const data = await listProjects();
            setProjects(data);

            setSelectedProject((current) =>
                current ? data.find((item) => item.id === current.id) ?? null : null
            );
        } catch (error) {
            setLoadError(error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadProjects();
    }, []);

    useEffect(() => {
        let active = true;

        async function loadAssociatedIssues() {
            if (!selectedProject) {
                setAssociatedIssues([]);
                setIssuesError('');
                setIssuesLoading(false);
                return;
            }

            setIssuesLoading(true);
            setIssuesError('');

            try {
                const data = await listProjectIssues(selectedProject.id);

                if (active) {
                    setAssociatedIssues(data);
                }
            } catch (error) {
                if (active) {
                    setIssuesError(errorMessage(error));
                    setAssociatedIssues([]);
                }
            } finally {
                if (active) {
                    setIssuesLoading(false);
                }
            }
        }

        void loadAssociatedIssues();

        return () => {
            active = false;
        };
    }, [selectedProject?.id]);

    const filteredProjects = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) return projects;

        return projects.filter((project) =>
            `${project.name} ${project.description}`.toLowerCase().includes(keyword)
        );
    }, [projects, search]);

    function openCreate() {
        setEditingProject(null);
        setForm(emptyForm);
        setFormError('');
        setCreateOpen(true);
    }

    function openEdit(project: Projects) {
        setEditingProject(project);
        setForm({
            name: project.name,
            description: project.description,
        });
        setFormError('');
        setCreateOpen(true);
    }

    function closeForm() {
        setCreateOpen(false);
        setEditingProject(null);
        setForm(emptyForm);
        setFormError('');
    }

    async function submitProject(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError('');

        if (form.name.trim().length < 2) {
            setFormError('Project name must contain at least 2 characters.');
            return;
        }

        setIsSaving(true);

        try {
            if (editingProject) {
                await updateProject(editingProject.id, {
                    name: form.name.trim(),
                    description: form.description.trim(),
                });

                notify('Project updated successfully.');
            } else {
                await createProject({
                    name: form.name.trim(),
                    description: form.description.trim(),
                });

                notify('New project created successfully.');
            }

            closeForm();
            await loadProjects();
        } catch (error) {
            setFormError(errorMessage(error));
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete(project: Projects) {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${project.name}"?`
        );

        if (!confirmed) return;

        setDeletingId(project.id);

        try {
            await deleteProject(project.id);

            if (selectedProject?.id === project.id) {
                setSelectedProject(null);
            }

            notify('Project deleted successfully.');
            await loadProjects();
        } catch (error) {
            notify(errorMessage(error));
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="content">
            <PageHeading
                title="Projects"
                subtitle="Organize your software projects and manage their investigation records."
                action={
                    <button
                        className="button-primary"
                        onClick={openCreate}
                        data-testid="button-create-project"
                    >
                        <Plus size={15} />
                        Create project
                    </button>
                }
            />

            <div className="toolbar">
                <div className="filters">
                    <label className="searchbar">
                        <Search size={15} />
                        <input
                            aria-label="Search projects"
                            placeholder="Search project name or description..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            data-testid="input-search-projects"
                        />
                    </label>
                </div>

                <span className="eyebrow">
                    {isLoading ? 'Loading...' : `${filteredProjects.length} projects`}
                </span>
            </div>

            {loadError ? (
                <section className="panel">
                    <ErrorState
                        message={errorMessage(loadError)}
                        onRetry={() => void loadProjects()}
                    />
                </section>
            ) : isLoading ? (
                <section className="panel" style={{ padding: 35, textAlign: 'center' }}>
                    <div className="panel-kicker">Loading your projects...</div>
                </section>
            ) : filteredProjects.length === 0 ? (
                <section className="panel">
                    <EmptyState
                        title={search ? 'No matching projects' : 'No projects yet'}
                        detail={
                            search
                                ? 'Try another search term.'
                                : 'Create your first project to start organizing bug investigations.'
                        }
                    />
                </section>
            ) : (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
                        gap: 16,
                    }}
                >
                    {filteredProjects.map((project) => (
                        <section
                            className="panel"
                            key={project.id}
                            style={{ padding: 20, minWidth: 0 }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: 12,
                                }}
                            >
                                <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                                    <div
                                        style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: 12,
                                            display: 'grid',
                                            placeItems: 'center',
                                            flexShrink: 0,
                                            background: 'var(--surface-soft, #eaf2f8)',
                                            color: 'var(--accent, #159fc4)',
                                        }}
                                    >
                                        <FolderKanban size={21} />
                                    </div>

                                    <div style={{ minWidth: 0 }}>
                                        <h3
                                            className="panel-title"
                                            style={{ overflowWrap: 'anywhere' }}
                                        >
                                            {project.name}
                                        </h3>
                                        <div className="panel-kicker" style={{ marginTop: 5 }}>
                                            Project workspace
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                    <button
                                        type="button"
                                        className="button-quiet"
                                        aria-label={`Edit ${project.name}`}
                                        title="Edit project"
                                        onClick={() => openEdit(project)}
                                        data-testid={`button-edit-project-${project.id}`}
                                    >
                                        <Pencil size={15} />
                                    </button>

                                    <button
                                        type="button"
                                        className="button-quiet"
                                        aria-label={`Delete ${project.name}`}
                                        title="Delete project"
                                        disabled={deletingId === project.id}
                                        onClick={() => void handleDelete(project)}
                                        data-testid={`button-delete-project-${project.id}`}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>

                            <p
                                style={{
                                    fontSize: 13,
                                    lineHeight: 1.65,
                                    opacity: 0.75,
                                    minHeight: 43,
                                    margin: '18px 0',
                                    overflowWrap: 'anywhere',
                                }}
                            >
                                {project.description || 'No project description provided.'}
                            </p>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    fontSize: 11,
                                    opacity: 0.7,
                                    marginBottom: 17,
                                }}
                            >
                                <CalendarDays size={13} />
                                Created: {new Date(project.created_at).toLocaleDateString()}
                            </div>

                            <div
                                style={{
                                    borderTop: '1px solid var(--border, #e5e9ef)',
                                    paddingTop: 13,
                                }}
                            >
                                <button
                                    type="button"
                                    className="button-secondary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() =>
                                        setSelectedProject(
                                            selectedProject?.id === project.id ? null : project
                                        )
                                    }
                                    data-testid={`button-view-project-${project.id}`}
                                >
                                    {selectedProject?.id === project.id
                                        ? 'Hide details'
                                        : 'View details'}
                                </button>
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {selectedProject && (
                <section className="panel" style={{ marginTop: 20, padding: 22 }}>
                    <div className="panel-head">
                        <div>
                            <h2 className="panel-title">Project Details</h2>
                            <div className="panel-kicker" style={{ marginTop: 4 }}>
                                Complete project information
                            </div>
                        </div>

                        <button
                            className="button-quiet"
                            onClick={() => setSelectedProject(null)}
                            aria-label="Close project details"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    <div className="form-grid" style={{ padding: 20 }}>
                        <div className="form-field">
                            <span className="form-label">Project name</span>
                            <div>{selectedProject.name}</div>
                        </div>

                        <div className="form-field">
                            <span className="form-label">Project ID</span>
                            <div style={{ overflowWrap: 'anywhere' }}>
                                {selectedProject.id}
                            </div>
                        </div>

                        <div className="form-field full">
                            <span className="form-label">Description</span>
                            <div style={{ lineHeight: 1.7 }}>
                                {selectedProject.description || 'No description provided.'}
                            </div>
                        </div>

                        <div className="form-field">
                            <span className="form-label">Created at</span>
                            <div>{new Date(selectedProject.created_at).toLocaleString()}</div>
                        </div>

                        <div className="form-field">
                            <span className="form-label">Last updated</span>
                            <div>{new Date(selectedProject.updated_at).toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Associated Issues */}
                    <div
                        style={{
                            borderTop: '1px solid var(--border, #e5e9ef)',
                            padding: '20px',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                flexWrap: 'wrap',
                                marginBottom: 16,
                            }}
                        >
                            <div>
                                <h3
                                    className="panel-title"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 9,
                                    }}
                                >
                                    <Bug size={17} />
                                    Associated Issues
                                </h3>
                                <div className="panel-kicker" style={{ marginTop: 5 }}>
                                    Investigations linked to this project
                                </div>
                            </div>

                            <span
                                className="eyebrow"
                                style={{
                                    padding: '6px 11px',
                                    borderRadius: 20,
                                    background: 'var(--surface-soft, #eaf2f8)',
                                }}
                            >
                                {issuesLoading ? 'Loading...' : `${associatedIssues.length} issues`}
                            </span>
                        </div>

                        {issuesLoading ? (
                            <div
                                style={{
                                    padding: 24,
                                    textAlign: 'center',
                                    color: 'var(--text-muted, #84909e)',
                                    fontSize: 13,
                                }}
                            >
                                Loading associated issues...
                            </div>
                        ) : issuesError ? (
                            <div className="error-note" style={{ padding: 14 }}>
                                {issuesError}
                            </div>
                        ) : associatedIssues.length === 0 ? (
                            <div
                                style={{
                                    padding: 24,
                                    textAlign: 'center',
                                    border: '1px dashed var(--border, #dce3eb)',
                                    borderRadius: 12,
                                }}
                            >
                                <Bug
                                    size={25}
                                    style={{
                                        opacity: 0.45,
                                        marginBottom: 8,
                                    }}
                                />
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    No associated issues yet
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        opacity: 0.65,
                                        marginTop: 5,
                                    }}
                                >
                                    Issues assigned to this project will appear here.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {associatedIssues.map((issue) => (
                                    <Link
                                        key={issue.id}
                                        href={`/issues/${encodeURIComponent(issue.id)}`}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 14,
                                            flexWrap: 'wrap',
                                            padding: '14px 16px',
                                            border: '1px solid var(--border, #e5e9ef)',
                                            borderRadius: 12,
                                            textDecoration: 'none',
                                            color: 'inherit',
                                            transition: 'border-color 0.2s ease, background 0.2s ease',
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 650,
                                                    overflowWrap: 'anywhere',
                                                    marginBottom: 6,
                                                }}
                                            >
                                                {issue.title}
                                            </div>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    gap: 7,
                                                    fontSize: 11,
                                                    opacity: 0.7,
                                                }}
                                            >
                                                <span>{issue.service}</span>
                                                <span>·</span>
                                                <span>Updated {formatDate(issue.updated_at)}</span>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                gap: 8,
                                            }}
                                        >
                                            <span className={`severity-pill severity-${issue.severity}`}>
                                                {humanize(issue.severity)}
                                            </span>

                                            <span className={`status-pill status-${issue.status}`}>
                                                {humanize(issue.status)}
                                            </span>

                                            <ExternalLink
                                                size={15}
                                                style={{
                                                    opacity: 0.6,
                                                    marginLeft: 3,
                                                }}
                                            />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {createOpen && (
                <div
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeForm();
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 40,
                        background: '#17243180',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 18,
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="project-form-title"
                        className="panel"
                        style={{
                            width: 'min(580px, 100%)',
                            maxHeight: '90dvh',
                            overflowY: 'auto',
                            boxShadow: '0 24px 70px #1d2b3860',
                        }}
                    >
                        <div className="panel-head">
                            <div>
                                <h2 className="panel-title" id="project-form-title">
                                    {editingProject ? 'Edit project' : 'Create a project'}
                                </h2>
                                <div className="panel-kicker" style={{ marginTop: 4 }}>
                                    {editingProject
                                        ? 'Update your project information'
                                        : 'Set up a workspace for your investigations'}
                                </div>
                            </div>

                            <button
                                className="button-quiet"
                                onClick={closeForm}
                                aria-label="Close"
                                data-testid="button-close-project-form"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <form onSubmit={submitProject} style={{ padding: 22 }}>
                            <div className="form-grid">
                                <label className="form-field full">
                                    <span className="form-label">Project name</span>
                                    <input
                                        className="field-input"
                                        minLength={2}
                                        maxLength={150}
                                        required
                                        autoFocus
                                        value={form.name}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))
                                        }
                                        placeholder="e.g. E-commerce Platform"
                                        data-testid="input-project-name"
                                    />
                                </label>

                                <label className="form-field full">
                                    <span className="form-label">Description</span>
                                    <textarea
                                        className="field-textarea"
                                        maxLength={2000}
                                        rows={4}
                                        value={form.description}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                        placeholder="Describe the purpose of this project..."
                                        data-testid="input-project-description"
                                    />
                                </label>
                            </div>

                            {formError && (
                                <div
                                    className="error-note"
                                    style={{ marginTop: 14 }}
                                    data-testid="status-project-form-error"
                                >
                                    {formError}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="button-secondary"
                                    onClick={closeForm}
                                    data-testid="button-cancel-project"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="button-primary"
                                    disabled={isSaving}
                                    data-testid="button-submit-project"
                                >
                                    {isSaving
                                        ? 'Saving...'
                                        : editingProject
                                            ? 'Save changes'
                                            : 'Create project'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
