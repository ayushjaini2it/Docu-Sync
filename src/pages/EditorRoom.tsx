import React, { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';
import { VersionHistory } from '../components/VersionHistory';
import { useYjsProvider } from '../hooks/useYjsProvider';
import { auth, trackRoomEntry, trackRoomExit } from '../utils/firebase';

export const EditorRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const user = auth?.currentUser;

  // Enforce authentication gate
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  // Supply real identity to cursors
  const { ydoc, awareness } = useYjsProvider(roomId, user.displayName || 'Guest', undefined);

  useEffect(() => {
    if (user && roomId) {
      trackRoomEntry(roomId, user);
      // Create a persistent heartbeat to combat ghost closures
      const heartbeat = setInterval(() => {
          trackRoomEntry(roomId, user);
      }, 15000);

      const cleanup = () => {
          clearInterval(heartbeat);
          trackRoomExit(roomId, user);
      };

      window.addEventListener('beforeunload', cleanup);
      return () => {
        window.removeEventListener('beforeunload', cleanup);
        cleanup();
      };
    }
  }, [roomId, user]);

  if (!ydoc || !awareness) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'white' }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontFamily: "'Outfit', sans-serif" }}>Loading Secure Engine...</h2>
                <p style={{ color: 'var(--text-muted)' }}>Synchronizing WebRTC P2P Keys</p>
            </div>
        </div>
    );
  }

  return (
    <Layout sidebar={<VersionHistory ydoc={ydoc} roomId={roomId} />} awareness={awareness}>
      <div style={{ 
          background: 'rgba(0, 0, 0, 0.2)', 
          margin: '2rem', 
          borderRadius: '16px', 
          border: '1px solid var(--border-subtle)', 
          height: 'calc(100% - 4rem)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
      }}>
        <div style={{ padding: '12px 20px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>Document Editor</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '12px' }}>ID: {roomId}</div>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <Editor ydoc={ydoc} awareness={awareness} />
        </div>
      </div>
    </Layout>
  );
};
