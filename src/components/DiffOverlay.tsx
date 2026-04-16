import React, { useMemo } from 'react';
import { X, Check, GitCommit, Plus, Minus } from 'lucide-react';
import type { DocumentSnapshot } from '../utils/firebase';
import { computeLineDiff, getYDocText, type DiffLine } from '../utils/diff';

interface Props {
  snapshot: DocumentSnapshot;
  currentText: string;
  onApply: () => void;
  onCancel: () => void;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const DiffOverlay: React.FC<Props> = ({ snapshot, currentText, onApply, onCancel }) => {
  const targetText = useMemo(() => getYDocText(snapshot.updateData), [snapshot.updateData]);

  // Full diff: current → target (what will change if we apply)
  const diff: DiffLine[] = useMemo(
    () => computeLineDiff(currentText, targetText),
    [currentText, targetText]
  );

  const addCount = diff.filter(d => d.type === 'add').length;
  const delCount = diff.filter(d => d.type === 'del').length;
  const noChanges = addCount === 0 && delCount === 0;

  return (
    <div className="diff-overlay-backdrop" onClick={onCancel}>
      <div className="diff-overlay-panel" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="diff-overlay-header">
          <div className="diff-overlay-title-row">
            <GitCommit size={16} className="diff-overlay-icon" />
            <div>
              <div className="diff-overlay-title">Checkout Preview</div>
              <div className="diff-overlay-subtitle">
                <span className="diff-hash">#{snapshot.shortHash}</span>
                <span className="diff-author">by {snapshot.authorName}</span>
                <span className="diff-time">{timeAgo(snapshot.createdAt)}</span>
              </div>
            </div>
          </div>
          <button className="diff-overlay-close" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* ── Commit message ── */}
        <div className="diff-overlay-commit-msg">"{snapshot.commitMessage}"</div>

        {/* ── Stats bar ── */}
        <div className="diff-stats-bar">
          <span className="diff-stat-add"><Plus size={12} /> {addCount} addition{addCount !== 1 ? 's' : ''}</span>
          <span className="diff-stat-del"><Minus size={12} /> {delCount} deletion{delCount !== 1 ? 's' : ''}</span>
          {noChanges && <span className="diff-stat-eq">No changes vs. current document</span>}
        </div>

        {/* ── Unified diff view ── */}
        <div className="diff-overlay-body">
          {noChanges ? (
            <div className="diff-overlay-no-diff">
              <GitCommit size={28} opacity={0.3} />
              <p>This commit matches the current document — nothing to change.</p>
            </div>
          ) : (
            <div className="diff-code-block">
              {diff.map((line, idx) => (
                <div
                  key={idx}
                  className={`diff-code-line ${
                    line.type === 'add' ? 'diff-code-add' :
                    line.type === 'del' ? 'diff-code-del' :
                    'diff-code-eq'
                  }`}
                >
                  <span className="diff-code-gutter">
                    {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
                  </span>
                  <span className="diff-code-text">{line.line || '\u00A0'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Action footer ── */}
        <div className="diff-overlay-footer">
          <button className="diff-btn-cancel" onClick={onCancel}>
            <X size={14} />
            Cancel
          </button>
          <button className="diff-btn-apply" onClick={onApply}>
            <Check size={14} />
            Apply Changes
          </button>
        </div>

      </div>
    </div>
  );
};
