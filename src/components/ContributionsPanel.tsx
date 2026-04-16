import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';

interface StatEntry {
  name: string;
  value: number;
  color: string;
}

interface Props {
  ydoc: Y.Doc;
}

export const ContributionsPanel: React.FC<Props> = ({ ydoc }) => {
  const [statsData, setStatsData] = useState<StatEntry[]>([]);

  useEffect(() => {
    const workStats = ydoc.getMap('workStats');

    const renderStats = () => {
      const merged = new Map<string, StatEntry>();

      workStats.forEach((v: any) => {
        if (merged.has(v.color)) {
          const current = merged.get(v.color)!;
          merged.set(v.color, { ...current, value: current.value + v.value });
        } else {
          merged.set(v.color, { name: v.name, value: v.value, color: v.color });
        }
      });

      setStatsData(Array.from(merged.values()).filter(s => s.value > 0));
    };

    renderStats();
    workStats.observe(renderStats);
    return () => workStats.unobserve(renderStats);
  }, [ydoc]);

  const total = statsData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="contributions-panel">
      <div className="contributions-panel-header">
        <BarChart2 size={15} />
        <span>Work Contributions</span>
      </div>

      {statsData.length === 0 ? (
        <div className="contributions-empty">
          <p>No data yet.</p>
          <span>Start typing to track contributions.</span>
        </div>
      ) : (
        <>
          {/* Donut chart */}
          <div style={{ width: '100%', height: 180, marginBottom: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {statsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--surface-raised)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    fontSize: '12px',
                  }}
                  itemStyle={{ fontWeight: 600, color: 'var(--text-main)' }}
                  formatter={(value) => [`${value != null ? Number(value).toLocaleString() : 0} chars`, 'Typed'] as [string, string]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend rows */}
          <div className="contributions-legend">
            {[...statsData].sort((a, b) => b.value - a.value).map((entry, index) => {
              const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
              return (
                <div key={`legend-${index}`} className="contributions-row">
                  <div className="contributions-row-left">
                    <div className="contributions-dot" style={{ backgroundColor: entry.color }} />
                    <span className="contributions-name">{entry.name}</span>
                  </div>
                  <div className="contributions-row-right">
                    <span className="contributions-chars">{entry.value.toLocaleString()} chars</span>
                    <span className="contributions-pct" style={{ color: entry.color }}>{percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="contributions-total">
            <span>Total characters typed</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{total.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
};
