import React, { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  awareness: Awareness;
  ydoc: Y.Doc;
}

export const ActiveUsers: React.FC<Props> = ({ awareness, ydoc }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<{name: string, value: number, color: string}[]>([]);

  useEffect(() => {
    const renderUsers = () => {
      const states = Array.from(awareness.getStates().values());
      const active = states.filter(state => state.user);
      setUsers(active);
    };

    renderUsers();
    awareness.on('change', renderUsers);

    return () => {
      awareness.off('change', renderUsers);
    };
  }, [awareness]);

  useEffect(() => {
    const workStats = ydoc.getMap('workStats');
    
    const renderStats = () => {
      const merged = new Map<string, any>();
      
      workStats.forEach((v: any) => {
        // Group by user explicitly using color to guarantee continuous slices
        if (merged.has(v.color)) {
          const current = merged.get(v.color);
          merged.set(v.color, { ...current, value: current.value + v.value });
        } else {
          merged.set(v.color, { name: v.name, value: v.value, color: v.color });
        }
      });
      
      setStatsData(Array.from(merged.values()).filter(s => s.value > 0));
    };

    renderStats();
    workStats.observe(renderStats);

    return () => {
      workStats.unobserve(renderStats);
    };
  }, [ydoc]);

  return (
    <div className="active-users-panel">
      
      {/* Bars of Active Users */}
      <div className="user-bars-list">
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
          {users.length} Users Online
        </div>
        {users.map((u, i) => (
          <div key={i} className="user-bar">
            <div className="user-bar-color-indicator" style={{ backgroundColor: u.user.color }}></div>
            <div className="user-bar-details">
              <span className="user-bar-name">{u.user.name}</span>
              <span className="user-bar-status">Editing</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pie Chart of Contributions */}
      {statsData.length > 0 && (
        <div className="pie-chart-container">
          <div className="pie-chart-title">Work Contributions</div>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {statsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', background: 'var(--surfaceRaised)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 600, color: 'var(--textMain)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Custom Percentage Legend */}
          <div style={{ width: '100%', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(() => {
              const total = statsData.reduce((acc, curr) => acc + curr.value, 0);
              return [...statsData].sort((a, b) => b.value - a.value).map((entry, index) => {
                const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
                return (
                  <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', paddingRight: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }}></div>
                      <span style={{ color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{entry.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{percent}%</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
