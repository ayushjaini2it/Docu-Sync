import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';
import { VersionHistory } from '../components/VersionHistory';
import { DiffOverlay } from '../components/DiffOverlay';
import { CodeEditor } from '../components/CodeEditor';
import { useYjsProvider } from '../hooks/useYjsProvider';
import { auth, trackRoomEntry, trackRoomExit, getRoomConfig, getRoomData, addDocumentToRoom, getUserRooms, updateUserPresence } from '../utils/firebase';
import { applySnapshotToDoc } from '../utils/diff';
import { clearDraft } from '../utils/draft';
import { MembersSummaryModal } from '../components/MembersSummaryModal';
import { Users, Download } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import type { DocumentSnapshot, WorkspaceRoom } from '../utils/firebase';

export const EditorRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const queryDocId = searchParams.get('doc');
  const navigate = useNavigate();

  // Reactive auth state — never read currentUser directly in render
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [authChecked, setAuthChecked] = useState(false);

  // Room metadata and multi-document support
  const [roomMeta, setRoomMeta] = useState<WorkspaceRoom | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(queryDocId);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [joinedRooms, setJoinedRooms] = useState(0);
  const [joinedDocumentCount, setJoinedDocumentCount] = useState(0);

  // Checkout diff preview ...
  const [checkoutTarget, setCheckoutTarget] = useState<DocumentSnapshot | null>(null);
  // Members Summary modal state
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  // Add Document form toggle
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  // Live Awareness-based user count
  const [onlineCount, setOnlineCount] = useState(1);
  const [roomConfig, setRoomConfig] = useState<{ type?: 'text'|'code', language?: string } | null>(null);

  useEffect(() => {
    if (roomId) {
      getRoomConfig(roomId).then(setRoomConfig);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    getRoomData(roomId).then(room => {
      if (!room) return;
      setRoomMeta(room);
      setActiveDocumentId(currId => {
        const preferred = queryDocId || currId;
        if (preferred && room.documents.some(doc => doc.docId === preferred)) return preferred;
        return room.documents[0]?.docId || roomId;
      });
    });
  }, [roomId, queryDocId]);

  const refreshUserCounts = async () => {
    if (!user) return;
    const rooms = await getUserRooms(user.uid);
    setJoinedRooms(rooms.length);
    setJoinedDocumentCount(rooms.reduce((sum, room) => sum + (room.documents?.length || 1), 0));
  };

  useEffect(() => {
    refreshUserCounts();
    const handleFocus = () => refreshUserCounts();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  useEffect(() => {
    if (!auth) { 
      setAuthChecked(true);
      return; 
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Update user presence when entering room/document
  useEffect(() => {
    if (user && roomId && activeDocumentId) {
      updateUserPresence(user.uid, user.displayName || 'Anonymous', user.photoURL || '', roomId, activeDocumentId);
    }
  }, [user, roomId, activeDocumentId]);

  // Always call hooks unconditionally — guards are below
  const { ydoc, awareness } = useYjsProvider(
    roomId && activeDocumentId ? `${roomId}-${activeDocumentId}` : roomId || '__placeholder__',
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
    clearDraft(roomId!, activeDocumentId || roomId!);  // checkout replaces working tree — wipe draft
    setCheckoutTarget(null);
  };

  const handleDownload = () => {
    if (!ydoc || !roomConfig) return;
    const text = roomConfig.type === 'code' ? ydoc.getText('monaco').toString() : ydoc.getText('quill').toString();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const docTitle = roomMeta?.documents?.find(d => d.docId === activeDocumentId)?.title || activeDocumentId || 'document';
    const ext = roomConfig.type === 'code' ? (roomConfig.language === 'javascript' ? 'js' : roomConfig.language === 'python' ? 'py' : roomConfig.language === 'java' ? 'java' : roomConfig.language === 'c++' ? 'cpp' : 'txt') : 'txt';
    link.download = `${docTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <Layout
      sidebar={
        <VersionHistory
          ydoc={ydoc}
          roomId={roomId}
          documentId={activeDocumentId || roomId}
          user={user}
          onCheckoutPreview={handleCheckoutPreview}
        />
      }
      awareness={awareness}
      ydoc={ydoc}
      roomId={roomId}
      documentId={activeDocumentId || roomId}
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
          <div style={{ fontWeight: 600, fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            Document Editor
            <button
              onClick={handleDownload}
              title="Download Document text"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--primary)', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '0.75rem', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
            >
              <Download size={13} />
              Export
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
              <button 
                className="editor-online-badge" 
                onClick={() => setIsMembersModalOpen(true)}
                title="View Room Members"
                style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="editor-online-dot" />
                {onlineCount} online
                <Users size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {joinedRooms} room{joinedRooms !== 1 ? 's' : ''} · {joinedDocumentCount} document{joinedDocumentCount !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {roomMeta?.documents?.length || 1} document{(roomMeta?.documents?.length || 1) !== 1 ? 's' : ''} in this room
              </div>
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
        <div style={{ padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              {(roomMeta?.documents || []).map((doc) => (
                <div key={doc.docId} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => {
                      setActiveDocumentId(doc.docId);
                      navigate(`/room/${roomId}?doc=${encodeURIComponent(doc.docId)}`);
                    }}
                    style={{
                      border: doc.docId === activeDocumentId ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: doc.docId === activeDocumentId ? 'rgba(59, 130, 246, 0.12)' : 'var(--surface-base)',
                      color: 'var(--text-main)',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                    }}
                  >
                    {doc.title}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', minHeight: '34px' }}>
              {!isAddingDoc ? (
                <button
                  onClick={() => setIsAddingDoc(true)}
                  title="Add new document"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--surface-base)',
                    border: '1px dashed var(--border-subtle)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    transition: 'all 0.2s',
                  }}
                >
                  +
                </button>
              ) : (
                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!roomId || !newDocumentTitle.trim()) return;
                  const slug = newDocumentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || Math.random().toString(36).slice(2, 8);
                  await addDocumentToRoom(roomId, slug, newDocumentTitle.trim());
                  const updatedRoom = await getRoomData(roomId);
                  setRoomMeta(updatedRoom);
                  setActiveDocumentId(slug);
                  navigate(`/room/${roomId}?doc=${encodeURIComponent(slug)}`);
                  setNewDocumentTitle('');
                  setIsAddingDoc(false);
                  if (user) {
                    const rooms = await getUserRooms(user.uid);
                    setJoinedRooms(rooms.length);
                    setJoinedDocumentCount(rooms.reduce((sum, room) => sum + (room.documents?.length || 1), 0));
                  }
                }} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    value={newDocumentTitle}
                    onChange={e => setNewDocumentTitle(e.target.value)}
                    placeholder="New document"
                    style={{ minWidth: '160px', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--surface-base)', color: 'var(--text-main)' }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingDoc(false)}
                    style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
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

          {/* Members Summary Modal */}
          {isMembersModalOpen && (
             <MembersSummaryModal
               isOpen={isMembersModalOpen}
               onClose={() => setIsMembersModalOpen(false)}
               members={roomMeta?.members || [user.uid]}
               currentUserId={user.uid}
             />
          )}
        </div>
      </div>
    </Layout>
  );
};
