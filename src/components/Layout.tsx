import React, { useState } from 'react';
import { PenTool, History, Home, LogOut, BarChart2, FolderOpen } from 'lucide-react';
import { ActiveUsers } from './ActiveUsers';
import { ContributionsPanel } from './ContributionsPanel';
import { WorkspaceSummary } from './WorkspaceSummary';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/firebase';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

export const Layout: React.FC<{ 
  children: React.ReactNode, 
  sidebar: React.ReactNode, 
  awareness: Awareness | null, 
  ydoc?: Y.Doc | null,
  roomId?: string,
  documentId?: string
}> = ({ children, sidebar, awareness, ydoc, roomId, documentId }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isContribOpen, setIsContribOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
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
          {awareness && ydoc && <ActiveUsers awareness={awareness} ydoc={ydoc} roomId={roomId || ''} documentId={documentId || ''} />}

          <div className="sidebar-divider" />

          {/* Contributions Panel Toggle */}
          {ydoc && (
            <button
              className={`btn-toggle-sidebar ${isContribOpen ? 'active' : ''}`}
              onClick={() => setIsContribOpen(!isContribOpen)}
              title="Toggle Work Contributions"
              style={isContribOpen ? { color: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
            >
              <BarChart2 size={20} />
            </button>
          )}

          {/* Workspace Summary Toggle */}
          <button
            className={`btn-toggle-sidebar ${isWorkspaceOpen ? 'active' : ''}`}
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            title="Toggle Workspace Summary"
            style={isWorkspaceOpen ? { color: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
          >
            <FolderOpen size={20} />
          </button>
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

        {/* Contributions Right Panel */}
        {isContribOpen && ydoc && (
          <aside className="contributions-aside">
            <ContributionsPanel ydoc={ydoc} />
          </aside>
        )}

        {/* Workspace Summary Right Panel */}
        {isWorkspaceOpen && (
          <aside className="workspace-aside">
            <WorkspaceSummary />
          </aside>
        )}
      </div>
    </div>
  );
};
