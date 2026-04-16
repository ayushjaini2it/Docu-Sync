import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { getSnapshots, saveSnapshot, deleteSnapshot, type DocumentSnapshot } from '../utils/firebase';
import { computeLineDiff, getYDocText, applySnapshotToDoc } from '../utils/diff';
import { saveDraft, loadDraft, clearDraft } from '../utils/draft';
import { GitCommit, GitBranch, ChevronDown, ChevronUp, Eye, RotateCcw, Plus, AlertTriangle, Check, X, RotateCw } from 'lucide-react';
import type { User } from 'firebase/auth';

interface Props {
  ydoc: Y.Doc;
  roomId: string;
  user: User | null;
  onCheckoutPreview: (snapshot: DocumentSnapshot) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Commit Entry ──────────────────────────────────────────────────────────────

interface CommitEntryProps {
  snapshot: DocumentSnapshot;
  isHead: boolean;
  prevSnapshot: DocumentSnapshot | null;
  isLast: boolean;
  commitsAbove: number;          // how many commits are newer than this one
  onCheckoutPreview: (snapshot: DocumentSnapshot) => void;
  onRevert: (snapshot: DocumentSnapshot, prevSnapshot: DocumentSnapshot | null) => void;
  onReset: (snapshot: DocumentSnapshot) => void;
  reverting: boolean;
  resetting: boolean;
}

const CommitEntry: React.FC<CommitEntryProps> = ({
  snapshot, isHead, prevSnapshot, isLast, commitsAbove,
  onCheckoutPreview, onRevert, onReset, reverting, resetting
}) => {
  const [expanded, setExpanded] = useState(false);
  const [diff, setDiff] = useState<Array<{ type: 'add' | 'del' | 'eq'; line: string }> | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleExpand = () => {
    if (!expanded && diff === null) {
      const newText = getYDocText(snapshot.updateData);
      const oldText = prevSnapshot ? getYDocText(prevSnapshot.updateData) : '';
      setDiff(computeLineDiff(oldText, newText));
    }
    setExpanded(v => !v);
  };

  const initials = snapshot.authorName
    .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const avatarColor = `hsl(${(snapshot.shortHash.charCodeAt(0) * 37) % 360}, 65%, 50%)`;

  return (
    <div className={`git-commit-entry ${isLast ? 'git-commit-last' : ''}`}>
      {/* Vertical connector */}
      <div className="git-connector-col">
        <div className={`git-commit-dot ${isHead ? 'git-dot-head' : ''}`} />
        {!isLast && <div className="git-line-segment" />}
      </div>

      {/* Commit body */}
      <div className="git-commit-body">
        <div
          className="git-commit-top"
          onClick={handleExpand}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && handleExpand()}
        >
          <div className="git-commit-row1">
            {isHead && <span className="git-head-badge">HEAD</span>}
            <span className="git-hash">#{snapshot.shortHash}</span>
            <span className="git-time">{timeAgo(snapshot.createdAt)}</span>
          </div>
          <div className="git-commit-message">{snapshot.commitMessage}</div>
          <div className="git-commit-author-row">
            {snapshot.authorAvatar ? (
              <img src={snapshot.authorAvatar} alt={snapshot.authorName} className="git-author-avatar" />
            ) : (
              <div className="git-author-initials" style={{ background: avatarColor }}>{initials}</div>
            )}
            <span className="git-author-name">{snapshot.authorName}</span>
            <button className="git-expand-btn" aria-label="Toggle diff">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Inline mini-diff (only +/- lines) */}
        {expanded && (
          <div className="git-diff-panel">
            {diff === null ? (
              <p className="git-diff-empty">Loading diff…</p>
            ) : diff.filter(d => d.type !== 'eq').length === 0 ? (
              <p className="git-diff-empty">No changes vs. previous commit.</p>
            ) : (
              <div className="git-diff-lines">
                {diff.map((d, idx) =>
                  d.type === 'eq' ? null : (
                    <div key={idx} className={`git-diff-line git-diff-${d.type}`}>
                      <span className="git-diff-symbol">{d.type === 'add' ? '+' : '−'}</span>
                      <span className="git-diff-text">{d.line || ' '}</span>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="git-action-row">
              {/* Checkout: preview full diff in editor overlay */}
              <button
                className="git-action-btn git-action-checkout"
                onClick={() => onCheckoutPreview(snapshot)}
                title="Preview what the editor will look like after applying this commit"
              >
                <Eye size={13} />
                Checkout
              </button>

              {/* Revert: create a new inverse commit */}
              <button
                className="git-action-btn git-action-revert"
                onClick={() => onRevert(snapshot, prevSnapshot)}
                disabled={reverting || resetting}
                title="Create a new commit that undoes this commit's changes"
              >
                {reverting ? <span className="git-spinner git-spinner-sm" /> : <RotateCcw size={13} />}
                Revert
              </button>
            </div>

            {/* Reset to here — only shown for non-HEAD commits */}
            {!isHead && commitsAbove > 0 && (
              !confirmReset ? (
                <button
                  className="git-reset-btn"
                  onClick={() => setConfirmReset(true)}
                  disabled={resetting}
                  title={`Delete the ${commitsAbove} commit${commitsAbove > 1 ? 's' : ''} above and reset to this point`}
                >
                  <RotateCw size={12} />
                  Reset to here
                </button>
              ) : (
                <div className="git-reset-confirm">
                  <div className="git-reset-confirm-text">
                    <AlertTriangle size={13} />
                    Delete <strong>{commitsAbove}</strong> newer commit{commitsAbove > 1 ? 's' : ''}? This cannot be undone.
                  </div>
                  <div className="git-reset-confirm-actions">
                    <button
                      className="git-reset-confirm-yes"
                      onClick={() => { setConfirmReset(false); onReset(snapshot); }}
                      disabled={resetting}
                    >
                      {resetting ? <span className="git-spinner git-spinner-sm" /> : <Check size={12} />}
                      Confirm
                    </button>
                    <button
                      className="git-reset-confirm-no"
                      onClick={() => setConfirmReset(false)}
                      disabled={resetting}
                    >
                      <X size={12} />
                      Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const VersionHistory: React.FC<Props> = ({ ydoc, roomId, user, onCheckoutPreview }) => {
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Draft recovery banner state
  const [draftInfo, setDraftInfo] = useState<{ savedAt: Date } | null>(null);
  const [resetToast, setResetToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstLoad = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: never save a draft during startup (prevents overwriting a real draft with HEAD state)
  const canSaveDraft = useRef(false);

  // ── Auto-save draft on every Yjs update (debounced 1.5s) ──────────────────
  useEffect(() => {
    // Safe base64 for large Uint8Arrays (avoids call-stack overflow on spread)
    const uint8ToB64 = (arr: Uint8Array): string => {
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < arr.length; i += chunk) {
        binary += String.fromCharCode(...arr.subarray(i, i + chunk));
      }
      return btoa(binary);
    };

    const handler = () => {
      if (!canSaveDraft.current) return;   // blocked during startup
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const blob = Y.encodeStateAsUpdate(ydoc);
        saveDraft(roomId, uint8ToB64(blob));
      }, 1500);
    };
    ydoc.on('update', handler);
    return () => {
      ydoc.off('update', handler);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [ydoc, roomId]);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const data = await getSnapshots(roomId);
      setSnapshots(data);

      // On first load: restore HEAD, then check for a newer unsaved draft
      if (isFirstLoad.current) {
        isFirstLoad.current = false;

        // 1. Apply HEAD first
        if (data.length > 0) {
          applySnapshotToDoc(ydoc, data[0].updateData);
        }

        // 2. Check if a local draft exists
        const draft = loadDraft(roomId);
        if (draft) {
          const headText = data.length > 0 ? getYDocText(data[0].updateData) : '';
          const draftText = getYDocText(draft.data);
          if (draftText.trim() !== headText.trim()) {
            setDraftInfo({ savedAt: draft.savedAt });
          } else {
            clearDraft(roomId);
          }
        }

        // 3. Only unlock auto-save AFTER startup has fully settled.
        //    3 seconds gives the Yjs WebRTC provider time to sync so it
        //    cannot fire an 'update' that overwrites the user's real draft.
        setTimeout(() => { canSaveDraft.current = true; }, 3000);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSnapshots(); }, []);

  const doCommit = async (msg: string): Promise<void> => {
    const updateBlob = Y.encodeStateAsUpdate(ydoc);
    const ytext = ydoc.getText('quill');
    const preview = (ytext.toString().trim() || 'Empty Document').substring(0, 40);
    await saveSnapshot(
      roomId, preview, updateBlob, msg,
      user?.displayName || 'Anonymous',
      user?.photoURL || ''
    );
  };

  const handleCommit = async () => {
    const msg = message.trim();
    if (!msg) { setError('Please enter a commit message.'); inputRef.current?.focus(); return; }
    setError('');
    setCommitting(true);
    try {
      await doCommit(msg);
      setMessage('');
      clearDraft(roomId);  // committed — draft no longer needed
      setDraftInfo(null);
      await fetchSnapshots();
    } catch (err) {
      console.error('Commit failed:', err);
      setError('Failed to save commit. Try again.');
    }
    setCommitting(false);
  };

  /**
   * git revert <hash>:
   *   1. Apply the state from BEFORE the target commit (prevSnapshot's state, or empty)
   *   2. Auto-create a new commit: "Revert: <original message>"
   */
  const handleRevert = async (
    snapshot: DocumentSnapshot,
    prevSnapshot: DocumentSnapshot | null
  ) => {
    setReverting(true);
    try {
      const ytext = ydoc.getText('quill');

      if (prevSnapshot) {
        // Apply the pre-revert state to the live doc
        const binary = atob(prevSnapshot.updateData);
        const blob = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) blob[i] = binary.charCodeAt(i);
        if (ytext.length > 0) ytext.delete(0, ytext.length);
        const tmp = new Y.Doc();
        Y.applyUpdate(tmp, blob);
        ytext.applyDelta(tmp.getText('quill').toDelta());
      } else {
        // No previous commit → revert to empty
        if (ytext.length > 0) ytext.delete(0, ytext.length);
      }

      // Auto-commit the revert
      await doCommit(`Revert: "${snapshot.commitMessage}"`);
      clearDraft(roomId);
      setDraftInfo(null);
      await fetchSnapshots();
    } catch (err) {
      console.error('Revert failed:', err);
    }
    setReverting(false);
  };

  const handleRestoreDraft = () => {
    const draft = loadDraft(roomId);
    if (!draft) return;
    applySnapshotToDoc(ydoc, draft.data);
    setDraftInfo(null);
    // Keep draft in storage until they commit it
  };

  const handleDiscardDraft = () => {
    clearDraft(roomId);
    setDraftInfo(null);
  };

  /**
   * git reset --hard <hash>:
   *   Deletes ALL commits newer than the target (parallel Firestore deletes),
   *   then applies the target's state to the editor.
   *   idx = position of the target in the sorted snapshots array (0 = HEAD).
   */
  const handleReset = async (snapshot: DocumentSnapshot) => {
    const idx = snapshots.findIndex(s => s.id === snapshot.id);
    if (idx <= 0) return;
    const toDelete = snapshots.slice(0, idx);
    setResetting(true);
    try {
      await Promise.all(toDelete.map(s => deleteSnapshot(s.id)));
      // NOTE: We intentionally do NOT apply the snapshot to the live Yjs doc.
      // The live doc is the shared working tree — resetting history should not
      // overwrite peers' unsaved work. Use Checkout to explicitly apply.
      clearDraft(roomId);
      setDraftInfo(null);
      setResetToast(`HEAD moved to #${snapshot.shortHash}. Use Checkout on the new HEAD to apply it to the editor.`);
      setTimeout(() => setResetToast(null), 6000);
      await fetchSnapshots();
    } catch (err) {
      console.error('Reset failed:', err);
    }
    setResetting(false);
  };

  return (
    <div className="git-sidebar">
      {/* Header */}
      <div className="git-sidebar-header">
        <GitBranch size={18} className="git-header-icon" />
        <span className="git-sidebar-title">Version Control</span>
      </div>
      <div className="git-branch-pill">
        <span className="git-branch-dot" />
        main
      </div>

      {/* Reset toast notification */}
      {resetToast && (
        <div className="git-reset-toast">
          <GitCommit size={13} />
          {resetToast}
        </div>
      )}

      {/* Draft recovery banner */}
      {draftInfo && (
        <div className="draft-recovery-banner">
          <div className="draft-banner-top">
            <AlertTriangle size={14} className="draft-banner-icon" />
            <div className="draft-banner-text">
              <strong>Unsaved draft found</strong>
              <span>Last autosaved {timeAgo(draftInfo.savedAt)}</span>
            </div>
          </div>
          <div className="draft-banner-actions">
            <button className="draft-btn-restore" onClick={handleRestoreDraft}>
              <Check size={13} /> Restore
            </button>
            <button className="draft-btn-discard" onClick={handleDiscardDraft}>
              <X size={13} /> Discard
            </button>
          </div>
        </div>
      )}

      {/* Commit input */}
      <div className="git-commit-input-panel">
        <input
          ref={inputRef}
          className={`git-message-input ${error ? 'git-message-input-error' : ''}`}
          placeholder="Describe your changes…"
          value={message}
          onChange={e => { setMessage(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleCommit()}
          maxLength={72}
          disabled={committing}
        />
        {error && <p className="git-input-error">{error}</p>}
        <button
          className="git-commit-btn"
          onClick={handleCommit}
          disabled={committing || !message.trim()}
        >
          {committing ? <span className="git-spinner" /> : <Plus size={14} />}
          {committing ? 'Committing…' : 'Commit'}
        </button>
      </div>

      {/* Section label */}
      <div className="git-section-label">
        <GitCommit size={13} />
        {snapshots.length} commit{snapshots.length !== 1 ? 's' : ''}
      </div>

      {/* Timeline */}
      <div className="git-timeline">
        {loading && (
          <div className="git-loading">
            <span className="git-spinner" />
            Loading history…
          </div>
        )}
        {!loading && snapshots.length === 0 && (
          <div className="git-empty-state">
            <GitCommit size={32} opacity={0.3} />
            <p>No commits yet.<br />Make your first commit above.</p>
          </div>
        )}
        {snapshots.map((s, idx) => (
          <CommitEntry
            key={s.id}
            snapshot={s}
            isHead={idx === 0}
            prevSnapshot={snapshots[idx + 1] || null}
            isLast={idx === snapshots.length - 1}
            commitsAbove={idx}          // number of commits newer than this one
            onCheckoutPreview={onCheckoutPreview}
            onRevert={handleRevert}
            onReset={handleReset}
            reverting={reverting}
            resetting={resetting}
          />
        ))}
      </div>
    </div>
  );
};
