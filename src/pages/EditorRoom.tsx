import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';
import { VersionHistory } from '../components/VersionHistory';
import { useYjsProvider } from '../hooks/useYjsProvider';
import { auth, trackRoomEntry, trackRoomExit } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

export const EditorRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Reactive auth state — never read currentUser directly in render
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!auth) { setAuthChecked(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Always call hooks unconditionally — guards are below
  const { ydoc, awareness } = useYjsProvider(
    roomId || '__placeholder__',
    user?.displayName || 'Guest',
    undefined
  );

  // Heartbeat presence tracking
  useEffect(() => {
    if (!user || !roomId) return;
    trackRoomEntry(roomId, user);

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
  }, [roomId, user]);

  // Loading state while Firebase resolves identity
  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }}>Establishing Identity...</h2>
        </div>
      </div>
    );
  }

  // Auth guard — redirect after check
  if (!user) {
    navigate('/', { replace: true });
    return null;
  }

  if (!roomId) {
    navigate('/', { replace: true });
    return null;
  }

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
    <Layout sidebar={<VersionHistory ydoc={ydoc} roomId={roomId} />} awareness={awareness} ydoc={ydoc}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-main)',
      }}>
        {/* Editor title bar */}
        <div style={{
          padding: '10px 20px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 600, fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', color: 'var(--text-main)' }}>
            Document Editor
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            background: 'var(--surface-base)',
            padding: '3px 10px',
            borderRadius: '20px',
            border: '1px solid var(--border-subtle)',
          }}>
            {roomId}
          </div>
        </div>
        {/* Editor fills remaining height */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Editor ydoc={ydoc} awareness={awareness} />
        </div>
      </div>
    </Layout>
  );
};
