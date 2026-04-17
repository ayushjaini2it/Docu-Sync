import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, Timestamp, where, doc, setDoc, getDoc, updateDoc, arrayUnion, deleteDoc, writeBatch } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";

// Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

const isFirebaseReady = firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== undefined;

export const app = isFirebaseReady ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

// Auth Helpers
export const signInWithGoogle = async () => {
  if (!auth) {
    alert("Firebase Auth is not configured. Simulating a mock identity for testing.");
    return { user: { displayName: "Demo User", photoURL: "", uid: "mock-uid-123" } };
  }
  const provider = new GoogleAuthProvider();
  return await signInWithRedirect(auth, provider);
};

export const registerWithEmail = async (email: string, pass: string, name: string) => {
  if (!auth) throw new Error("Firebase not initialized");
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(cred.user, { displayName: name });
  return cred;
};

export const loginWithEmail = async (email: string, pass: string) => {
  if (!auth) throw new Error("Firebase not initialized");
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const logout = async () => {
  if (!auth) return;
  return await signOut(auth);
};

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface UserPresence {
  userId: string;
  displayName: string;
  photoURL: string;
  lastActive: number;
  activeRooms: { roomId: string; documentId?: string }[];
}

export interface DocumentSnapshot {
  id: string;
  createdAt: Date;
  previewText: string;
  updateData: string;
  roomId: string;
  documentId?: string;
  userId: string;
  // Git-style fields
  commitMessage: string;
  authorName: string;
  authorAvatar: string;
  shortHash: string;
}

export interface RoomParticipant {
  uid: string;
  displayName: string;
  photoURL: string;
  lastActive: number;
}

export interface WorkspaceDocument {
  docId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceRoom {
  roomId: string;
  name: string;           // human-friendly name (falls back to roomId)
  createdAt: number;
  members: string[];
  activeParticipants: RoomParticipant[];
  documents: WorkspaceDocument[];
  lastPreview: string;    // text from most recent commit
  lastCommit: string;     // most recent commit message
  type?: 'text' | 'code';
  language?: string;
}

// ── Shared base64 helper (avoids call-stack overflow for large docs) ─────────
export const uint8ToB64 = (arr: Uint8Array): string => {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const mockDbKey = "docu-sync-snapshots";
const mockRoomsKey = "docu-sync-rooms";

// ── Room Management ──────────────────────────────────────────────────────────

/**
 * Create (or touch) a room document immediately when the user creates it
 * from the Dashboard. This persists the friendly name before first entry.
 */
export const createRoom = async (roomId: string, name: string, user: any, type: 'text' | 'code' = 'text', language?: string): Promise<void> => {
  if (db) {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
      await setDoc(roomRef, {
        roomId,
        name: name || roomId,
        createdAt: Date.now(),
        members: [user.uid],
        activeParticipants: [],
        documents: [{
          docId: roomId,
          title: name || roomId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        lastPreview: '',
        lastCommit: '',
        type,
        language: language || null,
      });
    }
  } else {
    const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
    if (!rooms.find((r: any) => r.roomId === roomId)) {
      rooms.unshift({
        roomId,
        name: name || roomId,
        createdAt: Date.now(),
        members: [(user as { uid?: string })?.uid || 'guest'],
        activeParticipants: [],
        documents: [{
          docId: roomId,
          title: name || roomId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        lastPreview: '',
        lastCommit: '',
        type,
        language: language || null,
      });
      localStorage.setItem(mockRoomsKey, JSON.stringify(rooms));
    }
  }
};

export const getRoomConfig = async (roomId: string): Promise<{ type?: 'text' | 'code', language?: string } | null> => {
  if (db) {
    const snap = await getDoc(doc(db, "rooms", roomId));
    if (snap.exists()) {
      return { type: snap.data().type || 'text', language: snap.data().language };
    }
    return null;
  }
  const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
  const room = rooms.find((r: any) => r.roomId === roomId);
  return room ? { type: room.type || 'text', language: room.language } : null;
};

export const getRoomData = async (roomId: string): Promise<WorkspaceRoom | null> => {
  if (db) {
    const snap = await getDoc(doc(db, "rooms", roomId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      roomId: data.roomId,
      name: data.name || data.roomId,
      createdAt: data.createdAt,
      members: data.members || [],
      activeParticipants: data.activeParticipants || [],
      documents: data.documents || [{ docId: data.roomId, title: data.name || data.roomId, createdAt: data.createdAt, updatedAt: data.createdAt }],
      lastPreview: data.lastPreview || '',
      lastCommit: data.lastCommit || '',
      type: data.type,
      language: data.language,
    };
  }

  const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
  const room = rooms.find((r: any) => r.roomId === roomId);
  if (!room) return null;
  return {
    roomId: room.roomId,
    name: room.name || room.roomId,
    createdAt: room.createdAt,
    members: room.members || [],
    activeParticipants: room.activeParticipants || [],
    documents: room.documents || [{ docId: room.roomId, title: room.name || room.roomId, createdAt: room.createdAt, updatedAt: room.createdAt }],
    lastPreview: room.lastPreview || '',
    lastCommit: room.lastCommit || '',
    type: room.type,
    language: room.language,
  };
};

export const addDocumentToRoom = async (roomId: string, docId: string, title: string): Promise<void> => {
  if (db) {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const data = roomSnap.data();

    const hasExistingArray = Array.isArray(data.documents) && data.documents.length > 0;
    if (hasExistingArray) {
      if (!data.documents.some((docItem: any) => docItem.docId === docId)) {
        await updateDoc(roomRef, {
          documents: arrayUnion({
            docId,
            title,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
        });
      }
    } else {
      // Legacy room with no documents array, instantiate both the default doc and the new doc
      const defaultDoc = { docId: data.roomId, title: data.name || data.roomId, createdAt: data.createdAt || Date.now(), updatedAt: data.createdAt || Date.now() };
      const newDoc = { docId, title, createdAt: Date.now(), updatedAt: Date.now() };
      await updateDoc(roomRef, { documents: [defaultDoc, newDoc] });
    }
  } else {
    const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
    const idx = rooms.findIndex((r: any) => r.roomId === roomId);
    if (idx === -1) return;
    const room = rooms[idx];

    const hasExistingArray = Array.isArray(room.documents) && room.documents.length > 0;
    if (!hasExistingArray) {
      room.documents = [{ docId: room.roomId, title: room.name || room.roomId, createdAt: room.createdAt, updatedAt: room.createdAt }];
    }

    if (!room.documents.some((docItem: any) => docItem.docId === docId)) {
      room.documents.push({ docId, title, createdAt: Date.now(), updatedAt: Date.now() });
      localStorage.setItem(mockRoomsKey, JSON.stringify(rooms));
    }
  }
};

export const getUserRooms = async (uid: string): Promise<WorkspaceRoom[]> => {
  if (db) {
    const q = query(collection(db, 'rooms'), where('members', 'array-contains', uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      roomId: d.data().roomId,
      name: d.data().name || d.data().roomId,
      createdAt: d.data().createdAt,
      members: d.data().members || [],
      activeParticipants: d.data().activeParticipants || [],
      documents: d.data().documents || [{ docId: d.data().roomId, title: d.data().name || d.data().roomId, createdAt: d.data().createdAt, updatedAt: d.data().createdAt }],
      lastPreview: d.data().lastPreview || '',
      lastCommit: d.data().lastCommit || '',
      type: d.data().type,
      language: d.data().language,
    }));
  }

  const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
  return rooms
    .filter((room: any) => (room.members || []).includes(uid))
    .map((room: any) => ({
      roomId: room.roomId,
      name: room.name || room.roomId,
      createdAt: room.createdAt,
      members: room.members || [],
      activeParticipants: room.activeParticipants || [],
      documents: room.documents || [{ docId: room.roomId, title: room.name || room.roomId, createdAt: room.createdAt, updatedAt: room.createdAt }],
      lastPreview: room.lastPreview || '',
      lastCommit: room.lastCommit || '',
      type: room.type,
      language: room.language,
    }));
};

/** Listen for changes to user's rooms */
export const onUserRoomsChange = (uid: string, callback: (rooms: WorkspaceRoom[]) => void) => {
  if (db) {
    const q = query(collection(db, 'rooms'), where('members', 'array-contains', uid));
    return onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(d => ({
        roomId: d.data().roomId,
        name: d.data().name || d.data().roomId,
        createdAt: d.data().createdAt,
        members: d.data().members || [],
        activeParticipants: d.data().activeParticipants || [],
        documents: d.data().documents || [{ docId: d.data().roomId, title: d.data().name || d.data().roomId, createdAt: d.data().createdAt, updatedAt: d.data().createdAt }],
        lastPreview: d.data().lastPreview || '',
        lastCommit: d.data().lastCommit || '',
        type: d.data().type,
        language: d.data().language,
      }));
      callback(rooms);
    });
  } else {
    // For mock, just call once and set up a focus listener
    getUserRooms(uid).then(callback);
    const handleFocus = () => getUserRooms(uid).then(callback);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }
};

/**
 * Delete a room document AND all its snapshots in one operation.
 * Prevents orphan snapshot data in Firestore.
 */
export const deleteRoomAndSnapshots = async (roomId: string): Promise<void> => {
  if (db) {
    // Query all snapshots for this room
    const snapshotsQ = query(collection(db, "snapshots"), where("roomId", "==", roomId));
    const snapshotDocs = await getDocs(snapshotsQ);

    // Use a batch for atomic delete (Firestore batch supports up to 500 ops)
    const batch = writeBatch(db);
    snapshotDocs.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, "rooms", roomId));
    await batch.commit();
  } else {
    // localStorage fallback
    const snapshots = JSON.parse(localStorage.getItem(mockDbKey) || "[]");
    localStorage.setItem(mockDbKey, JSON.stringify(existing.filter((s: { roomId: string }) => s.roomId !== roomId)));
    const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
    localStorage.setItem(mockRoomsKey, JSON.stringify(rooms.filter((r: { roomId: string }) => r.roomId !== roomId)));
  }
};

// ── Presence Tracking ────────────────────────────────────────────────────────

export const trackRoomEntry = async (roomId: string, user: { uid: string; displayName?: string; photoURL?: string } | unknown): Promise<void> => {
  if (!db || !user) return;
  const roomRef = doc(db, "rooms", roomId);
  const typedUser = user as { uid: string; displayName?: string; photoURL?: string };
  const participantData: RoomParticipant = {
    uid: typedUser.uid,
    displayName: typedUser.displayName || 'Guest',
    photoURL: typedUser.photoURL || '',
    lastActive: Date.now()
  };

  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      roomId,
      name: roomId,
      createdAt: Date.now(),
      members: [typedUser.uid],
      activeParticipants: [participantData],
      lastPreview: '',
      lastCommit: '',
    });
  } else {
    const activeRaw = roomSnap.data().activeParticipants || [];
    const newActive = activeRaw.filter((p: { uid: string }) => p.uid !== typedUser.uid);
    newActive.push(participantData);
    await updateDoc(roomRef, {
      members: arrayUnion(typedUser.uid),
      activeParticipants: newActive
    });
  }
};

export const trackRoomExit = async (roomId: string, user: { uid: string } | unknown): Promise<void> => {
  if (!db || !user) return;
  const roomRef = doc(db, "rooms", roomId);
  const typedUser = user as { uid: string };
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) {
    const activeRaw = roomSnap.data().activeParticipants || [];
    const newActive = activeRaw.filter((p: { uid: string }) => p.uid !== typedUser.uid);
    await updateDoc(roomRef, { activeParticipants: newActive });
  }
};

// ── Snapshots ────────────────────────────────────────────────────────────────

const generateShortHash = (): string =>
  Math.floor(Math.random() * 0xfffffff).toString(16).padStart(7, '0');

export const saveSnapshot = async (
  roomId: string,
  documentId: string,
  previewText: string,
  updateBlob: Uint8Array,
  commitMessage: string,
  authorName: string,
  authorAvatar: string,
  userId: string
): Promise<void> => {
  const base64Update = uint8ToB64(updateBlob);   // chunked, safe for large docs
  const shortHash = generateShortHash();

  if (db) {
    await addDoc(collection(db, "snapshots"), {
      createdAt: Timestamp.now(),
      roomId,
      documentId,
      previewText,
      updateData: base64Update,
      commitMessage,
      authorName,
      authorAvatar,
      shortHash,
      userId,
    });
    // Also update the room's lastPreview / lastCommit so Dashboard can show it
    try {
      await updateDoc(doc(db, "rooms", roomId), {
        lastPreview: previewText,
        lastCommit: commitMessage,
      });
    } catch {
      // Room doc may not exist yet in edge cases — non-fatal
    }
  } else {
    const existing = JSON.parse(localStorage.getItem(mockDbKey) || "[]");
    localStorage.setItem(mockDbKey, JSON.stringify([{
      id: Math.random().toString(36).substring(7),
      roomId,
      documentId,
      createdAt: new Date().toISOString(),
      previewText,
      updateData: base64Update,
      commitMessage,
      authorName,
      authorAvatar,
      shortHash,
      userId,
    }, ...existing]));

    // Update localStorage room
    const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
    const idx = rooms.findIndex((r: any) => r.roomId === roomId);
    if (idx !== -1) {
      rooms[idx].lastPreview = previewText;
      rooms[idx].lastCommit = commitMessage;
      localStorage.setItem(mockRoomsKey, JSON.stringify(rooms));
    }
  }
};

export const getSnapshots = async (roomId: string, documentId?: string, userId?: string): Promise<DocumentSnapshot[]> => {
  if (db) {
    let q = query(collection(db, "snapshots"), where("roomId", "==", roomId));
    if (documentId) {
      q = query(collection(db, "snapshots"), where("roomId", "==", roomId), where("documentId", "==", documentId));
    }
    if (userId) {
      q = query(q, where("userId", "==", userId));
    }
    try {
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(d => ({
        id: d.id,
        roomId: d.data().roomId,
        documentId: d.data().documentId || roomId,
        createdAt: d.data().createdAt.toDate(),
        previewText: d.data().previewText,
        updateData: d.data().updateData,
        commitMessage: d.data().commitMessage || 'Snapshot',
        authorName: d.data().authorName || 'Unknown',
        authorAvatar: d.data().authorAvatar || '',
        shortHash: d.data().shortHash || d.id.substring(0, 7),
        userId: d.data().userId || '',
      }));
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (e) {
      console.error("Firestore Error (likely missing index):", e);
      return [];
    }
  } else {
    const existing = JSON.parse(localStorage.getItem(mockDbKey) || "[]");
    return existing
      .filter((item: any) => item.roomId === roomId && (!documentId || item.documentId === documentId) && (!userId || item.userId === userId))
      .map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        commitMessage: item.commitMessage || 'Snapshot',
        authorName: item.authorName || 'Unknown',
        authorAvatar: item.authorAvatar || '',
        shortHash: item.shortHash || item.id.substring(0, 7),
        userId: item.userId || '',
      }))
      .sort((a: DocumentSnapshot, b: DocumentSnapshot) => b.createdAt.getTime() - a.createdAt.getTime());
  }
};

/** Delete a single snapshot by its Firestore document ID. */
export const deleteSnapshot = async (id: string): Promise<void> => {
  if (db) {
    await deleteDoc(doc(db, "snapshots", id));
  } else {
    const existing = JSON.parse(localStorage.getItem(mockDbKey) || "[]");
    localStorage.setItem(
      mockDbKey,
      JSON.stringify(existing.filter((item: { id: string }) => item.id !== id))
    );
  }
};

/** Update user presence with active room/document. */
export const updateUserPresence = async (userId: string, displayName: string, photoURL: string, roomId: string, documentId?: string): Promise<void> => {
  if (db) {
    const presenceRef = doc(db, "presence", userId);
    const presenceDoc = await getDoc(presenceRef);
    const now = Date.now();
    if (presenceDoc.exists()) {
      const data = presenceDoc.data() as UserPresence;
      const activeRooms = data.activeRooms || [];
      // Remove existing entry for this room if any, then add new one
      const filtered = activeRooms.filter(r => r.roomId !== roomId);
      filtered.push({ roomId, documentId });
      await updateDoc(presenceRef, {
        displayName,
        photoURL,
        lastActive: now,
        activeRooms: filtered.slice(-5), // Keep last 5 active rooms
      });
    } else {
      await setDoc(presenceRef, {
        userId,
        displayName,
        photoURL,
        lastActive: now,
        activeRooms: [{ roomId, documentId }],
      } as UserPresence);
    }
  } else {
    // Mock storage: store in localStorage under "presence"
    const presenceKey = "mockPresence";
    const existing = JSON.parse(localStorage.getItem(presenceKey) || "{}");
    const now = Date.now();
    if (existing[userId]) {
      const activeRooms = existing[userId].activeRooms || [];
      const filtered = activeRooms.filter((r: any) => r.roomId !== roomId);
      filtered.push({ roomId, documentId });
      existing[userId] = {
        userId,
        displayName,
        photoURL,
        lastActive: now,
        activeRooms: filtered.slice(-5),
      };
    } else {
      existing[userId] = {
        userId,
        displayName,
        photoURL,
        lastActive: now,
        activeRooms: [{ roomId, documentId }],
      };
    }
    localStorage.setItem(presenceKey, JSON.stringify(existing));
  }
};

/** Get all active user presences (last active within 5 minutes). */
export const getAllUserPresences = async (): Promise<UserPresence[]> => {
  if (db) {
    const q = query(collection(db, "presence"));
    const querySnapshot = await getDocs(q);
    const now = Date.now();
    return querySnapshot.docs
      .map(d => d.data() as UserPresence)
      .filter(p => now - p.lastActive < 5 * 60 * 1000); // Active within 5 minutes
  } else {
    const presenceKey = "mockPresence";
    const existing = JSON.parse(localStorage.getItem(presenceKey) || "{}");
    const now = Date.now();
    return Object.values(existing).filter((p: any) => now - p.lastActive < 5 * 60 * 1000) as UserPresence[];
  }
};

/** Listen for changes to all user presences */
export const onAllUserPresencesChange = (callback: (presences: UserPresence[]) => void) => {
  if (db) {
    const q = query(collection(db, "presence"));
    return onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const presences = snapshot.docs
        .map(d => d.data() as UserPresence)
        .filter(p => now - p.lastActive < 5 * 60 * 1000);
      callback(presences);
    });
  } else {
    // For mock, poll every 30 seconds
    getAllUserPresences().then(callback);
    const interval = setInterval(() => getAllUserPresences().then(callback), 30000);
    return () => clearInterval(interval);
  }
};
