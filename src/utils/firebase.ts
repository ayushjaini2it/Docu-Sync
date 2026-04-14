import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, Timestamp, where, doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
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
    // Graceful fallback for demo
    alert("Firebase Auth is not configured. Simulating a mock identity for testing.");
    return { user: { displayName: "Demo User", photoURL: "", uid: "mock-uid-123" } };
  }
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
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
}

export interface DocumentSnapshot {
  id: string;
  createdAt: Date;
  previewText: string;
  updateData: string;
  roomId: string;
  name?: string;
}

export interface RoomParticipant {
  uid: string;
  displayName: string;
  photoURL: string;
  lastActive: number;
}

export interface WorkspaceRoom {
  roomId: string;
  createdAt: number;
  members: string[]; // List of uids who have ever joined
  activeParticipants: RoomParticipant[]; // Array representing current online users
}

const mockDbKey = "docu-sync-snapshots";

// Global Room Presence
export const trackRoomEntry = async (roomId: string, user: any) => {
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
    // Initialize room on very first entry
    await setDoc(roomRef, {
      roomId,
      createdAt: Date.now(),
      members: [user.uid],
      activeParticipants: [participantData]
    });
  } else {
    // Add user to history and bind them to active participants
    const activeRaw = roomSnap.data().activeParticipants || [];
    // Filter out previous ghost instances of this exact user before adding fresh one
    const newActive = activeRaw.filter((p: any) => p.uid !== user.uid);
    newActive.push(participantData);

    await updateDoc(roomRef, {
      members: arrayUnion(user.uid),
      activeParticipants: newActive
    });
  }
};

export const trackRoomExit = async (roomId: string, user: any) => {
  if (!db || !user) return;
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (roomSnap.exists()) {
    const activeRaw = roomSnap.data().activeParticipants || [];
    // Purge user from online state
    const newActive = activeRaw.filter((p: any) => p.uid !== user.uid);
    await updateDoc(roomRef, {
      activeParticipants: newActive
    });
  }
};

export const saveSnapshot = async (roomId: string, previewText: string, updateBlob: Uint8Array, name?: string): Promise<void> => {
  const base64Update = btoa(String.fromCharCode(...updateBlob));

  if (db) {
    await addDoc(collection(db, "snapshots"), {
      createdAt: Timestamp.now(),
      roomId,
      previewText,
      updateData: base64Update,
      ...(name && { name })
    });
  } else {
    const existing = JSON.parse(localStorage.getItem(mockDbKey) || "[]");
    const newSnapshot = {
      id: Math.random().toString(36).substring(7),
      roomId,
      createdAt: new Date().toISOString(),
      previewText,
      updateData: base64Update,
      ...(name && { name })
    };
    localStorage.setItem(mockDbKey, JSON.stringify([newSnapshot, ...existing]));
  }
};

export const getSnapshots = async (roomId: string): Promise<DocumentSnapshot[]> => {
  // We remove orderBy("createdAt", "desc") from the query so we don't need a custom Composite Index
  if (db) {
    const q = query(
      collection(db, "snapshots"), 
      where("roomId", "==", roomId)
    );
    try {
        const querySnapshot = await getDocs(q);
        const results = querySnapshot.docs.map(doc => ({
            id: doc.id,
            roomId: doc.data().roomId,
            createdAt: doc.data().createdAt.toDate(),
            previewText: doc.data().previewText,
            updateData: doc.data().updateData,
            name: doc.data().name
        }));
        
        // Natively sort the results descending in Javascript!
        return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (e) {
        // If index is missing, return empty or fallback so it doesn't crash the app wildly
        console.error("Firestore Error (likely missing index):", e);
        return [];
    }
    
  } else {
    // Filter local storage gracefully
    const existing = JSON.parse(localStorage.getItem(mockDbKey) || "[]");
    return existing
      .filter((item: any) => item.roomId === roomId)
      .map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt)
      }));
  }
};
