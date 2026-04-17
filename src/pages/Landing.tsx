import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Sun, Moon, History, Layers, ArrowRight, Code2 } from 'lucide-react';
import { ThemeContext } from '../ThemeContext';
import './Landing.css';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext)!;

  useEffect(() => {
    document.title = "DocuSync - Real-Time Sync";
  }, []);

  return (
    <div className="hq-landing-page">
      {/* Navigation */}
      <nav className="hq-landing-nav">
        <div className="hq-landing-brand">
          <Terminal size={24} color="var(--primary)" />
          <span>DocuSync</span>
        </div>

        <div className="hq-landing-links">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hq-icon-link">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            <span>GitHub</span>
          </a>

          <button className="hq-icon-link" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <button className="hq-btn-login" onClick={() => navigate('/dashboard', { state: { mode: 'signin' } })}>
            Sign In
          </button>
        </div>
      </nav>

      {/* Primary Hero */}
      <main className="hq-hero">
        <div className="hq-badge">Welcome to v2.0</div>
        <h1 className="hq-title">
          Sync your Doc,<br />
          <span className="hq-text-highlight">instantly.</span>
        </h1>

        <p className="hq-subtitle">
          Experience real-time collaboration with unparalleled speed. Build, write, and innovate together with our premium suite of text editing tools.
        </p>

        <div className="hq-hero-actions">
          <button className="hq-btn-primary" onClick={() => navigate('/dashboard')}>
            Get Started <ArrowRight size={18} />
          </button>
          <button className="hq-btn-secondary" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            Explore Features
          </button>
        </div>
      </main>

      {/* Clean Features Grid */}
      <section id="features" className="hq-features-grid">
        <div className="hq-feature-card">
          <div className="hq-arch-icon color-blue">
            <History size={26} />
          </div>
          <h3>Immutable History</h3>
          <p>Every keystroke is cleanly versioned via our CRDT-backed snapshotting framework so you never lose data.</p>
        </div>

        <div className="hq-feature-card">
          <div className="hq-arch-icon color-purple">
            <Layers size={26} />
          </div>
          <h3>Conflict Resolution</h3>
          <p>Automatic, deterministic merging guarantees all state converges instantly across peers without manual tweaks.</p>
        </div>

        <div className="hq-feature-card">
          <div className="hq-arch-icon color-indigo">
            <Code2 size={26} />
          </div>
          <h3>Lightning Speed</h3>
          <p>WebRTC zero-latency peer connection powers flawless live typing experiences alongside your teammates.</p>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="hq-footer">
        <p>&copy; {new Date().getFullYear()} DocuSync. Distributed collaboration for modern workflows.</p>
      </footer>
    </div>
  );
};