import React, { useEffect, useState } from 'react';
import { X, User as UserIcon, Code, FileText, ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import { getUserRooms, getAllUserPresences } from '../utils/firebase';
import type { WorkspaceRoom, UserPresence } from '../utils/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: string[];       // array of member UIDs
  currentUserId: string;   // the current user's UID
}

export const MembersSummaryModal: React.FC<Props> = ({ isOpen, onClose, members, currentUserId }) => {
  const [userData, setUserData] = useState<Record<string, { rooms: WorkspaceRoom[], presence?: UserPresence }>>({});
  const [loading, setLoading] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const presences = await getAllUserPresences();
        const presenceMap = new Map(presences.map(p => [p.userId, p]));
        
        const dataMap: Record<string, { rooms: WorkspaceRoom[], presence?: UserPresence }> = {};
        
        // Fetch rooms for all members concurrently
        await Promise.all(
          members.map(async (uid) => {
            const spaces = await getUserRooms(uid);
            dataMap[uid] = {
              rooms: spaces,
              presence: presenceMap.get(uid),
            };
          })
        );
        setUserData(dataMap);
        
        // Auto-expand the first member (or current user)
        if (members.length > 0) {
            setExpandedUsers({ [currentUserId]: true });
        }
      } catch (err) {
        console.error("Failed to fetch user data for summary:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [isOpen, members, currentUserId]);

  if (!isOpen) return null;

  const toggleUser = (uid: string) => setExpandedUsers(prev => ({ ...prev, [uid]: !prev[uid] }));

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', padding: '24px', borderRadius: '16px',
        width: '100%', maxWidth: '600px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-subtle)',
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: "'Outfit', sans-serif", color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutGrid size={20} /> Room Members Overview
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading network topology...</div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {members.map(uid => {
              const data = userData[uid];
              if (!data) return null;
              
              const totalRooms = data.rooms.length;
              const totalDocs = data.rooms.reduce((acc, r) => acc + (r.documents?.length || 1), 0);
              const displayName = data.presence?.displayName || (uid === currentUserId ? 'You' : `User (${uid.substring(0, 5)})`);
              const isExpanded = expandedUsers[uid];
              
              return (
                <div key={uid} style={{ border: '1px solid var(--border-subtle)', borderRadius: '12px', background: 'var(--surface-base)', overflow: 'hidden' }}>
                  <div 
                    onClick={() => toggleUser(uid)}
                    style={{ 
                      padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                      background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-raised)', color: 'var(--text-main)' }}>
                      {data.presence?.photoURL ? (
                        <img src={data.presence.photoURL} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                         <UserIcon size={16} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {displayName}
                         {uid === currentUserId && <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px' }}>You</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {totalRooms} room{totalRooms !== 1 && 's'} · {totalDocs} document{totalDocs !== 1 && 's'}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {data.rooms.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active rooms.</div>
                      ) : (
                        data.rooms.map(room => (
                           <div key={room.roomId}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500, marginBottom: '6px' }}>
                               {room.type === 'code' ? <Code size={14} color="#a855f7" /> : <FileText size={14} color="#38bdf8" />}
                               {room.name && room.name !== room.roomId ? room.name : room.roomId}
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '20px' }}>
                                {(room.documents || [{ docId: room.roomId, title: room.name || room.roomId }]).map(doc => (
                                    <div key={doc.docId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-subtle)' }} />
                                        {doc.title}
                                    </div>
                                ))}
                             </div>
                           </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
