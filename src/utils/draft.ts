/**
 * Local draft persistence — saves the Yjs state update blob to localStorage
 * so uncommitted changes survive connection drops and page refreshes.
 */

const draftKey = (roomId: string) => `docu-sync-draft-${roomId}`;
const draftTsKey = (roomId: string) => `docu-sync-draft-ts-${roomId}`;

export const saveDraft = (roomId: string, base64Blob: string): void => {
  localStorage.setItem(draftKey(roomId), base64Blob);
  localStorage.setItem(draftTsKey(roomId), Date.now().toString());
};

export const loadDraft = (roomId: string): { data: string; savedAt: Date } | null => {
  const data = localStorage.getItem(draftKey(roomId));
  const ts = localStorage.getItem(draftTsKey(roomId));
  if (!data) return null;
  return { data, savedAt: new Date(ts ? parseInt(ts, 10) : Date.now()) };
};

export const clearDraft = (roomId: string): void => {
  localStorage.removeItem(draftKey(roomId));
  localStorage.removeItem(draftTsKey(roomId));
};
