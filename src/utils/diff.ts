import * as Y from 'yjs';
import type { DocumentSnapshot } from './firebase';

export type DiffLine = { type: 'add' | 'del' | 'eq'; line: string };

export function getYDocText(updateDataB64: string): string {
  try {
    const binary = atob(updateDataB64);
    const blob = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) blob[i] = binary.charCodeAt(i);
    const tmp = new Y.Doc();
    Y.applyUpdate(tmp, blob);
    return tmp.getText('quill').toString();
  } catch {
    return '';
  }
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      result.push({ type: 'eq', line: oldLines[i] }); i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ type: 'add', line: newLines[j] }); j++;
    } else {
      result.push({ type: 'del', line: oldLines[i] }); i++;
    }
  }
  return result;
}

export function applySnapshotToDoc(ydoc: Y.Doc, updateDataB64: string) {
  const binary = atob(updateDataB64);
  const blob = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) blob[i] = binary.charCodeAt(i);
  const ytext = ydoc.getText('quill');
  if (ytext.length > 0) ytext.delete(0, ytext.length);
  const tmp = new Y.Doc();
  Y.applyUpdate(tmp, blob);
  ytext.applyDelta(tmp.getText('quill').toDelta());
}

/** Returns the text state just BEFORE `target` commit (i.e. prevSnapshot's state, or empty) */
export function getPreRevertText(prevSnapshot: DocumentSnapshot | null): string {
  if (!prevSnapshot) return '';
  return getYDocText(prevSnapshot.updateData);
}
