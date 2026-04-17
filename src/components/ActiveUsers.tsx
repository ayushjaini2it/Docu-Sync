import React, { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import { getSnapshots } from '../utils/firebase';
import type { DocumentSnapshot } from '../utils/firebase';
import { DiffOverlay } from './DiffOverlay';

interface AwarenessUser {
  name: string;
  color: string;
  photoURL?: string;
  userId?: string;
}

interface Props {
  awareness: Awareness;
  ydoc?: any; // kept for API compat, no longer used here
  roomId: string;
  documentId: string;
}

export const ActiveUsers: React.FC<Props> = ({ awareness, roomId, documentId }) => {
  const [users, setUsers] = useState<AwarenessUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AwarenessUser | null>(null);
  const [userSnapshots, setUserSnapshots] = useState<DocumentSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<DocumentSnapshot | null>(null);

  useEffect(() => {
    const render = () => {
      const states = Array.from(awareness.getStates().values()) as Array<{ user?: AwarenessUser }>;
      const allUsers = states.filter(s => s.user).map(s => s.user!);
      const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.userId || u.name, u])).values());
      setUsers(uniqueUsers);
    };

    render();
    awareness.on('change', render);
    return () => awareness.off('change', render);
  }, [awareness]);

  const handleUserClick = async (user: AwarenessUser) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      let snapshots = await getSnapshots(roomId, documentId, user.userId);
      if (!user.userId) {
        snapshots = snapshots.filter(s => s.authorName === user.name);
      }
      setUserSnapshots(snapshots);
    } catch (error) {
      console.error('Failed to load user snapshots:', error);
      setUserSnapshots([]);
    }
    setLoading(false);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setUserSnapshots([]);
    setPreviewSnapshot(null);
  };

  const handleCommitClick = (snapshot: DocumentSnapshot) => {
    setPreviewSnapshot(snapshot);
  };

  if (users.length === 0) return null;

  return (
    <>
      <div className="active-users-vertical">
        <div className="avatars-group-vertical">
          {users.slice(0, 6).map((u, i) => (
            <div
              key={i}
              className="avatar-vertical clickable"
              style={{ borderColor: u.color, background: u.photoURL ? 'transparent' : u.color, cursor: 'pointer' }}
              title={`${u.name} - Click to view their work`}
              onClick={() => handleUserClick(u)}
            >
              {u.photoURL ? (
                <img
                  src={u.photoURL}
                  alt={u.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span>{u.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
          ))}
          {users.length > 6 && (
            <div className="avatar-vertical avatar-overflow" title={`${users.length - 6} more`}>
              +{users.length - 6}
            </div>
          )}
        </div>
        <div className="users-tooltip">{users.length} Online</div>
      </div>

      {/* User Work Modal */}
      {selectedUser && (
        <div className="user-work-modal-overlay" onClick={closeModal}>
          <div className="user-work-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedUser.name}'s Work in This Document</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-content">
              {loading ? (
                <div className="loading">Loading commits...</div>
              ) : userSnapshots.length === 0 ? (
                <div className="no-commits">No commits found for this user in this document.</div>
              ) : (
                <div className="commits-list">
                  {userSnapshots.map(snapshot => (
                    <div key={snapshot.id} className="commit-item">
                      <div className="commit-header">
                        <div className="commit-hash">{snapshot.shortHash}</div>
                        <div className="commit-date">{new Date(snapshot.createdAt).toLocaleString()}</div>
                      </div>
                      <button
                        type="button"
                        className="commit-message-button"
                        onClick={() => handleCommitClick(snapshot)}
                      >
                        {snapshot.commitMessage}
                      </button>
                      <div className="commit-preview">{snapshot.previewText}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewSnapshot && (
        <DiffOverlay
          snapshot={previewSnapshot}
          currentText=""
          onApply={() => {}}
          onCancel={() => setPreviewSnapshot(null)}
          previewOnly
        />
      )}
    </>
  );
};
