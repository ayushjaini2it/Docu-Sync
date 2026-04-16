import { useState, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';

const USER_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];
const USER_NAMES  = ['Anonymous Hippo', 'Curious Cheetah', 'Sleek Python', 'Silent Owl', 'Happy Dolphin', 'Brave Lion', 'Electric Fox'];

export function useYjsProvider(
  roomName: string,
  userName?: string,
  userColor?: string,
  userPhotoURL?: string,         // ← new: propagate avatar into awareness
  userId?: string                // ← new: unique user id to deduplicate instead of name
) {
  const [ydoc, setYdoc]           = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);

  useEffect(() => {
    const doc      = new Y.Doc();
    const provider = new WebsocketProvider('wss://websocket-docu-sync.up.railway.app', roomName, doc);

    console.log(`[YJS] 🛰️ Connecting to Railway WS server for room: ${roomName}`);

    provider.on('status', (event: any) => {
      console.log(`[YJS] 💡 Connection Status:`, event.status);
    });

    provider.awareness.on('change', () => {
      const peers = provider.awareness.getStates().size;
      console.log(`[YJS] 👥 Peers changed. Total connected (including you): ${peers}`);
      if (peers > 1) {
        console.log("%c[YJS] ✅ SYNC ESTABLISHED WITH PEER", "color: green; font-weight: bold;");
      }
    });

    const fallbackColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    const fallbackName  = USER_NAMES [Math.floor(Math.random() * USER_NAMES.length)];

    provider.awareness.setLocalStateField('user', {
      name:     userName     || fallbackName,
      color:    userColor    || fallbackColor,
      photoURL: userPhotoURL || '',       // always include, even if empty
      userId:   userId       || '',
    });

    setYdoc(doc);
    setAwareness(provider.awareness);

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [roomName]);

  // Update awareness fields when auth resolves after the provider is up
  useEffect(() => {
    if (!awareness) return;
    const current = awareness.getLocalState();
    if (!current) return;
    awareness.setLocalStateField('user', {
      ...current.user,
      name:     userName     || current.user?.name     || '',
      color:    userColor    || current.user?.color    || USER_COLORS[0],
      photoURL: userPhotoURL || current.user?.photoURL || '',
      userId:   userId       || current.user?.userId   || '',
    });
  }, [awareness, userName, userColor, userPhotoURL, userId]);

  return { ydoc, awareness };
}
