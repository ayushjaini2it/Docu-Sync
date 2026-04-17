import React, { useEffect, useState } from 'react';
import { onUserRoomsChange, onAllUserPresencesChange } from '../utils/firebase';
import { auth } from '../utils/firebase';
import type { User } from 'firebase/auth';
import type { WorkspaceRoom, UserPresence } from '../utils/firebase';

export const WorkspaceSummary: React.FC = () => {
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [rooms, setRooms] = useState<WorkspaceRoom[]>([]);
  const [presences, setPresences] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!user) return;

    // Set up listeners
    const unsubscribeRooms = onUserRoomsChange(user.uid, (userRooms) => {
      setRooms(userRooms);
    });

    const unsubscribePresences = onAllUserPresencesChange((allPresences) => {
      setPresences(allPresences);
    });

    // Cleanup
    return () => {
      if (unsubscribeRooms) unsubscribeRooms();
      if (unsubscribePresences) unsubscribePresences();
    };
  }, [user]);

  useEffect(() => {
    if (!auth) return;
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  const totalDocuments = rooms.reduce((sum, room) => sum + (room.documents?.length || 1), 0);

  return (
    <div className="workspace-summary">
      <h3>Workspace Summary</h3>
      
      {/* User's Own Activity */}
      <div className="user-activity">
        <h4>Your Activity</h4>
        <div className="activity-summary">
          <div>Active in {rooms.length} room{rooms.length !== 1 ? 's' : ''}</div>
          <div>Working on {totalDocuments} document{totalDocuments !== 1 ? 's' : ''}</div>
        </div>
        <div className="rooms-list">
          {rooms.map(room => (
            <div key={room.roomId} className="room-item">
              <div className="room-name">{room.name || `Room ${room.roomId}`}</div>
              <div className="room-docs">{room.documents?.length || 1} documents</div>
              <ul>
                {room.documents?.map(doc => (
                  <li key={doc.docId}>{doc.title || `Document ${doc.docId}`}</li>
                )) || <li>Main Document</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
      
      {/* Other Users Activity */}
      <div className="global-users">
        <h4>Other Online Users ({presences.filter(p => p.userId !== user?.uid).length})</h4>
        {presences.filter(p => p.userId !== user?.uid).map(presence => (
          <div key={presence.userId} className="user-item">
            <div className="user-name">{presence.displayName}</div>
            <div className="user-activity">
              Active in {presence.activeRooms.length} room{presence.activeRooms.length !== 1 ? 's' : ''}: {presence.activeRooms.map(r => r.roomId).join(', ')}
            </div>
            <div className="user-docs">
              Working on {presence.activeRooms.reduce((sum, r) => sum + (r.documentId ? 1 : 0), 0)} documents
            </div>
            <div className="user-details">
              <strong>Rooms:</strong>
              <ul>
                {presence.activeRooms.map((r, idx) => (
                  <li key={idx}>Room {r.roomId}{r.documentId ? ` - Document ${r.documentId}` : ' (Main Document)'}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};