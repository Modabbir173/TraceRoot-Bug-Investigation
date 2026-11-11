
export interface Projects {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectInput {
  name: string;
  description: string;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
}

const TOKEN_KEY = 'traceroot_access_token';
const API_URL = '/api/projects';

async function projectRequest<T>(
  endpoint: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : 'Something went wrong. Please try again.';

    throw new Error(message);
  }

  return data as T;
}

export function listProjects(): Promise<Projects[]> {
  return projectRequest<Projects[]>('', 'GET');
}

export function getProject(projectId: string): Promise<Projects> {
  return projectRequest<Projects>(
    `/${encodeURIComponent(projectId)}`,
    'GET',
  );
}

export function createProject(
  payload: ProjectInput,
): Promise<Projects> {
  return projectRequest<Projects>('', 'POST', payload);
}

export function updateProject(
  projectId: string,
  payload: ProjectUpdateInput,
): Promise<Projects> {
  return projectRequest<Projects>(
    `/${encodeURIComponent(projectId)}`,
    'PATCH',
    payload,
  );
}

export function deleteProject(projectId: string): Promise<void> {
  return projectRequest<void>(
    `/${encodeURIComponent(projectId)}`,
    'DELETE',
  );
}
