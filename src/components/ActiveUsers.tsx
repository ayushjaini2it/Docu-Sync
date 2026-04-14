import React, { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';

interface Props {
  awareness: Awareness;
}

export const ActiveUsers: React.FC<Props> = ({ awareness }) => {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const renderUsers = () => {
      const states = Array.from(awareness.getStates().values());
      // Filter out users that don't have a name/color (e.g. disconnected wrappers)
      const active = states.filter(state => state.user);
      setUsers(active);
    };

    renderUsers();

    awareness.on('change', renderUsers);
    return () => {
      awareness.off('change', renderUsers);
    };
  }, [awareness]);

  return (
    <div className="active-users-vertical">
      <div className="avatars-group-vertical">
        {users.slice(0, 5).map((u, i) => (
          <div 
            key={i} 
            className="avatar-vertical" 
            style={{ backgroundColor: u.user.color }}
            title={u.user.name}
          >
            {u.user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <div className="users-tooltip">{users.length} Online</div>
    </div>
  );
};
