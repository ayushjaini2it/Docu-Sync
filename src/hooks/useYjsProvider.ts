import { useState, useEffect } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import type { Awareness } from 'y-protocols/awareness';

// Constants for Member 3 avatar colors
const USER_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];
const USER_NAMES = ['Anonymous Hippo', 'Curious Cheetah', 'Sleek Python', 'Silent Owl', 'Happy Dolphin', 'Brave Lion', 'Electric Fox'];

export function useYjsProvider(roomName: string, userName?: string, userColor?: string) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);

  useEffect(() => {
    // Member 2: Initialize Core Yjs Engine
    const doc = new Y.Doc();
    
    // Connect to WebRTC Provider for P2P Real-Time Sync
    const provider = new WebrtcProvider(roomName, doc);
    
    // Member 3: Setup Local Awareness State
    const fallbackColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    const fallbackName = USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];
    
    provider.awareness.setLocalStateField('user', {
      name: userName || fallbackName,
      color: userColor || fallbackColor
    });

    setYdoc(doc);
    setAwareness(provider.awareness);

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [roomName]);

  return { ydoc, awareness };
}
