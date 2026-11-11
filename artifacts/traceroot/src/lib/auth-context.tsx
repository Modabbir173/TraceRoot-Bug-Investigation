
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  type AuthUser,
  login,
  register,
  getCurrentUser,
  logout,
  isAuthenticated,
} from './auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    full_name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      setIsLoading(false);
      return;
    }

    getCurrentUser()
      .then(setUser)
      .catch(() => {
        logout();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(email: string, password: string) {
    const response = await login(email, password);
    setUser(response.user);
  }

  async function signUp(
    full_name: string,
    email: string,
    password: string,
  ) {
    await register(full_name, email, password);
    await signIn(email, password);
  }

  function signOut() {
    logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
