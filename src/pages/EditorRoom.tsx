import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';
import { VersionHistory } from '../components/VersionHistory';
import { DiffOverlay } from '../components/DiffOverlay';
import { CodeEditor } from '../components/CodeEditor';
import { useYjsProvider } from '../hooks/useYjsProvider';
import { auth, trackRoomEntry, trackRoomExit, getRoomConfig } from '../utils/firebase';
import { applySnapshotToDoc } from '../utils/diff';
import { clearDraft } from '../utils/draft';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import type { DocumentSnapshot } from '../utils/firebase';

export const EditorRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Reactive auth state — never read currentUser directly in render
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [authChecked, setAuthChecked] = useState(false);

  // Checkout diff preview ...
  const [checkoutTarget, setCheckoutTarget] = useState<DocumentSnapshot | null>(null);
  // Live Awareness-based user count
  const [onlineCount, setOnlineCount] = useState(1);
  const [roomConfig, setRoomConfig] = useState<{ type?: 'text'|'code', language?: string } | null>(null);

  useEffect(() => {
    if (roomId) {
      getRoomConfig(roomId).then(setRoomConfig);
    }
  }, [roomId]);

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
    undefined,
    user?.photoURL || undefined,
    user?.uid
  );

  // Live online count from Yjs awareness
  useEffect(() => {
    if (!awareness) return;
    const update = () => {
      const states = Array.from(awareness.getStates().values());
      const allUsers = states.filter((s: any) => s.user).map((s: any) => s.user);
      // Deduplicate by userId if available, otherwise by name.
      const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.userId || u.name, u])).values());
      setOnlineCount(uniqueUsers.length || 1);
    };
    update();
    awareness.on('change', update);
    return () => awareness.off('change', update);
  }, [awareness]);

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

  if (!ydoc || !awareness || !roomConfig) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }}>Loading Secure Engine...</h2>
          <p style={{ color: 'var(--text-muted)' }}>Synchronizing WebRTC P2P Keys</p>
        </div>
      </div>
    );
  }

  const handleCheckoutPreview = (snapshot: DocumentSnapshot) => {
    setCheckoutTarget(snapshot);
  };

  const handleApplyCheckout = () => {
    if (!checkoutTarget || !ydoc) return;
    applySnapshotToDoc(ydoc, checkoutTarget.updateData);
    clearDraft(roomId!);  // checkout replaces working tree — wipe draft
    setCheckoutTarget(null);
  };

  return (
    <Layout
      sidebar={
        <VersionHistory
          ydoc={ydoc}
          roomId={roomId}
          user={user}
          onCheckoutPreview={handleCheckoutPreview}
        />
      }
      awareness={awareness}
      ydoc={ydoc}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-main)',
        position: 'relative',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Live online badge */}
            <div className="editor-online-badge">
              <span className="editor-online-dot" />
              {onlineCount} online
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
        </div>

        {/* Editor fills remaining height */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {roomConfig.type === 'code' ? (
            <CodeEditor ydoc={ydoc} awareness={awareness} language={roomConfig.language || 'javascript'} />
          ) : (
            <Editor ydoc={ydoc} awareness={awareness} />
          )}

          {/* Diff checkout overlay — renders on top of the editor */}
          {checkoutTarget && (
            <DiffOverlay
              snapshot={checkoutTarget}
              currentText={ydoc.getText('quill').toString()}
              onApply={handleApplyCheckout}
              onCancel={() => setCheckoutTarget(null)}
            />
          )}
        </div>
      </div>
    </Layout>
  );
};
