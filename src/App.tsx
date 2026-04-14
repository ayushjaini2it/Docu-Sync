import React, { useEffect, useState, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { EditorRoom } from './pages/EditorRoom';
import { auth } from './utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const ThemeContext = createContext<{ theme: 'light' | 'dark', toggleTheme: () => void }>({ theme: 'light', toggleTheme: () => {} });

const App: React.FC = () => {
  const [loadingObj, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('docusync-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('docusync-theme', newTheme);
  };

  useEffect(() => {
    if (!auth) {
        setLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, () => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingObj) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: 'var(--text-main)' }}>Establishing Identity...</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/room/:roomId" element={<EditorRoom />} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeContext.Provider>
  );
};

export default App;
