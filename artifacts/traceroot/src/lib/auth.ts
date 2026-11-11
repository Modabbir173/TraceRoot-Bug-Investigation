
import { setAuthTokenGetter } from '@workspace/api-client-react';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

const TOKEN_KEY = 'traceroot_access_token';

// Automatically attach JWT to generated API requests.
setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

async function authRequest<T>(
  endpoint: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(`/api/auth${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || 'Something went wrong. Please try again.',
    );
  }

  return data as T;
}

export async function register(
  full_name: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  return authRequest<AuthUser>('/register', 'POST', {
    full_name,
    email,
    password,
  });
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const data = await authRequest<LoginResponse>('/login', 'POST', {
    email,
    password,
  });

  localStorage.setItem(TOKEN_KEY, data.access_token);

  return data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  return authRequest<AuthUser>('/me', 'GET');
}

export async function updateProfile(
  full_name?: string,
  email?: string,
): Promise<AuthUser> {
  return authRequest<AuthUser>('/me', 'PATCH', {
    full_name,
    email,
  });
}

export async function changePassword(
  current_password: string,
  new_password: string,
): Promise<{ message: string }> {
  return authRequest<{ message: string }>('/change-password', 'POST', {
    current_password,
    new_password,
  });
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}
