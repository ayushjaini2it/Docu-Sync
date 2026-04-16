import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, Timestamp, where, doc, setDoc, getDoc, updateDoc, arrayUnion, deleteDoc, writeBatch } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";

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

export interface DocumentSnapshot {
  id: string;
  createdAt: Date;
  previewText: string;
  updateData: string;
  roomId: string;
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

export interface WorkspaceRoom {
  roomId: string;
  name: string;           // human-friendly name (falls back to roomId)
  createdAt: number;
  members: string[];
  activeParticipants: RoomParticipant[];
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
        members: [user?.uid || 'guest'],
        activeParticipants: [],
        lastPreview: '',
        lastCommit: '',
        type,
        language: language || null,
      });
      localStorage.setItem(mockRoomsKey, JSON.stringify(rooms));
    }
  }
};

export const getRoomConfig = async (roomId: string): Promise<{ type?: 'text'|'code', language?: string } | null> => {
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
    localStorage.setItem(mockDbKey, JSON.stringify(snapshots.filter((s: any) => s.roomId !== roomId)));
    const rooms = JSON.parse(localStorage.getItem(mockRoomsKey) || "[]");
    localStorage.setItem(mockRoomsKey, JSON.stringify(rooms.filter((r: any) => r.roomId !== roomId)));
  }
};

// ── Presence Tracking ────────────────────────────────────────────────────────

export const trackRoomEntry = async (roomId: string, user: any): Promise<void> => {
  if (!db || !user) return;
  const roomRef = doc(db, "rooms", roomId);
  const participantData: RoomParticipant = {
    uid: user.uid,
    displayName: user.displayName || 'Guest',
    photoURL: user.photoURL || '',
    lastActive: Date.now()
  };

  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      roomId,
      name: roomId,
      createdAt: Date.now(),
      members: [user.uid],
      activeParticipants: [participantData],
      lastPreview: '',
      lastCommit: '',
    });
  } else {
    const activeRaw = roomSnap.data().activeParticipants || [];
    const newActive = activeRaw.filter((p: any) => p.uid !== user.uid);
    newActive.push(participantData);
    await updateDoc(roomRef, {
      members: arrayUnion(user.uid),
      activeParticipants: newActive
    });
  }
};

export const trackRoomExit = async (roomId: string, user: any): Promise<void> => {
  if (!db || !user) return;
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) {
    const activeRaw = roomSnap.data().activeParticipants || [];
    const newActive = activeRaw.filter((p: any) => p.uid !== user.uid);
    await updateDoc(roomRef, { activeParticipants: newActive });
  }
};

// ── Snapshots ────────────────────────────────────────────────────────────────

const generateShortHash = (): string =>
  Math.floor(Math.random() * 0xfffffff).toString(16).padStart(7, '0');

export const saveSnapshot = async (
  roomId: string,
  previewText: string,
  updateBlob: Uint8Array,
  commitMessage: string,
  authorName: string,
  authorAvatar: string
): Promise<void> => {
  const base64Update = uint8ToB64(updateBlob);   // chunked, safe for large docs
  const shortHash = generateShortHash();

  if (db) {
    await addDoc(collection(db, "snapshots"), {
      createdAt: Timestamp.now(),
      roomId,
      previewText,
      updateData: base64Update,
      commitMessage,
      authorName,
      authorAvatar,
      shortHash,
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
      createdAt: new Date().toISOString(),
      previewText,
      updateData: base64Update,
      commitMessage,
      authorName,
      authorAvatar,
      shortHash,
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

export const getSnapshots = async (roomId: string): Promise<DocumentSnapshot[]> => {
  if (db) {
    const q = query(collection(db, "snapshots"), where("roomId", "==", roomId));
    try {
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(d => ({
        id: d.id,
        roomId: d.data().roomId,
        createdAt: d.data().createdAt.toDate(),
        previewText: d.data().previewText,
        updateData: d.data().updateData,
        commitMessage: d.data().commitMessage || 'Snapshot',
        authorName: d.data().authorName || 'Unknown',
        authorAvatar: d.data().authorAvatar || '',
        shortHash: d.data().shortHash || d.id.substring(0, 7),
      }));
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (e) {
      console.error("Firestore Error (likely missing index):", e);
      return [];
    }
  } else {
    const existing = JSON.parse(localStorage.getItem(mockDbKey) || "[]");
    return existing
      .filter((item: any) => item.roomId === roomId)
      .map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        commitMessage: item.commitMessage || 'Snapshot',
        authorName: item.authorName || 'Unknown',
        authorAvatar: item.authorAvatar || '',
        shortHash: item.shortHash || item.id.substring(0, 7),
      }));
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
      JSON.stringify(existing.filter((item: any) => item.id !== id))
    );
  }
};
