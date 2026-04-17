import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { EditorRoom } from './pages/EditorRoom';
import { Landing } from './pages/Landing';
import { auth } from './utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ThemeContext } from './ThemeContext';

const getSavedTheme = (): 'light' | 'dark' => {
  const savedTheme = localStorage.getItem('docusync-theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    return 'dark';
  }
  return 'light';
};

const App: React.FC = () => {
  const [loadingObj, setLoading] = useState(!auth);
  const [theme, setTheme] = useState<'light' | 'dark'>(getSavedTheme());

  useEffect(() => {
    const currentTheme = theme;
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('docusync-theme', newTheme);
  };

  useEffect(() => {
    if (!auth) {
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
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/room/:roomId" element={<EditorRoom />} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeContext.Provider>
  );
};

export default App;
