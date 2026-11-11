
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  compactUI: boolean;
  setCompactUI: (value: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getBoolean(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('traceroot_theme') === 'dark'
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  const [compactUI, setCompactUI] = useState(
    () => getBoolean('traceroot_compact_ui')
  );

  const [reduceMotion, setReduceMotion] = useState(
    () => getBoolean('traceroot_reduce_motion')
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('traceroot_theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('compact-ui', compactUI);
    try {
      localStorage.setItem('traceroot_compact_ui', String(compactUI));
    } catch {}
  }, [compactUI]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    try {
      localStorage.setItem('traceroot_reduce_motion', String(reduceMotion));
    } catch {}
  }, [reduceMotion]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      compactUI,
      setCompactUI,
      reduceMotion,
      setReduceMotion,
    }),
    [theme, compactUI, reduceMotion]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreferences() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useThemePreferences must be used inside ThemeProvider'
    );
  }

  return context;
}
