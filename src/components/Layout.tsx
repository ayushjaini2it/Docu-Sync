import React, { useState } from 'react';
import { PenTool, History, Home, LogOut } from 'lucide-react';
import { ActiveUsers } from './ActiveUsers';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/firebase';
import type { Awareness } from 'y-protocols/awareness';

export const Layout: React.FC<{ children: React.ReactNode, sidebar: React.ReactNode, awareness: Awareness | null }> = ({ children, sidebar, awareness }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      {/* Modern Narrow Left Sidebar */}
      <nav className="left-sidebar">
        <div className="brand-section-vertical">
          <div className="logo-icon">
            <PenTool size={22} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="sidebar-vertical-actions">
          <button 
            className="btn-toggle-sidebar" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Toggle Time Travel Panel"
          >
            <History size={20} />
          </button>
          
          <div className="sidebar-divider" />

          {/* Member 3 User Presence Hub - Stacked */}
          {awareness && <ActiveUsers awareness={awareness} />}
        </div>

        {/* Global Navigation Actions at the very bottom */}
        <div className="sidebar-vertical-actions" style={{ marginTop: 'auto' }}>
          <button 
            className="btn-toggle-sidebar" 
            onClick={() => navigate('/')}
            title="Return to Dashboard / Change Room"
          >
            <Home size={20} />
          </button>
          <button 
            className="btn-toggle-sidebar" 
            onClick={() => { logout(); navigate('/'); }}
            title="Sign Out"
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>
      
      {/* Responsive Body Container */}
      <div className="app-body">
        {/* Member 4 Time Travel Sidebar (kept on the left) */}
        <aside className={`main-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
          {sidebar}
        </aside>

        {/* Editor Central Hub */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};
