import React, { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';

interface AwarenessUser {
  name: string;
  color: string;
  photoURL?: string;
  userId?: string;
}

interface Props {
  awareness: Awareness;
  ydoc?: any; // kept for API compat, no longer used here
}

export const ActiveUsers: React.FC<Props> = ({ awareness }) => {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

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

  if (users.length === 0) return null;

  return (
    <div className="active-users-vertical">
      <div className="avatars-group-vertical">
        {users.slice(0, 6).map((u, i) => (
          <div
            key={i}
            className="avatar-vertical"
            style={{ borderColor: u.color, background: u.photoURL ? 'transparent' : u.color }}
            title={u.name}
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
  );
};
