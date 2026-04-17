/**
 * Local draft persistence — saves the Yjs state update blob to localStorage
 * so uncommitted changes survive connection drops and page refreshes.
 */

const draftKey = (roomId: string, documentId: string) => `docu-sync-draft-${roomId}-${documentId}`;
const draftTsKey = (roomId: string, documentId: string) => `docu-sync-draft-ts-${roomId}-${documentId}`;

export const saveDraft = (roomId: string, documentId: string, base64Blob: string): void => {
  localStorage.setItem(draftKey(roomId, documentId), base64Blob);
  localStorage.setItem(draftTsKey(roomId, documentId), Date.now().toString());
};

export const loadDraft = (roomId: string, documentId: string): { data: string; savedAt: Date } | null => {
  const data = localStorage.getItem(draftKey(roomId, documentId));
  const ts = localStorage.getItem(draftTsKey(roomId, documentId));
  if (!data) return null;
  return { data, savedAt: new Date(ts ? parseInt(ts, 10) : Date.now()) };
};

export const clearDraft = (roomId: string, documentId: string): void => {
  localStorage.removeItem(draftKey(roomId, documentId));
  localStorage.removeItem(draftTsKey(roomId, documentId));
};
