import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import QuillCursors from 'quill-cursors';
import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';
import type { Awareness } from 'y-protocols/awareness';

// Register the cursor module
Quill.register('modules/cursors', QuillCursors);

interface Props {
  ydoc: Y.Doc;
  awareness: Awareness;
}

export const Editor: React.FC<Props> = ({ ydoc, awareness }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef<boolean>(false);
  const bindingRef = useRef<QuillBinding | null>(null);
  
  useEffect(() => {
    if (!containerRef.current || isInitialized.current) return;
    
    isInitialized.current = true;

    // Create inner div so React doesn't fight over DOM modifications
    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme: 'snow',
      modules: {
        cursors: true,
        toolbar: [ 
          ['bold', 'italic', 'underline'], 
          [{ 'header': 1 }, { 'header': 2 }], 
          [{ 'list': 'ordered'}, { 'list': 'bullet' }] 
        ]
      }
    });
    
    const ytext = ydoc.getText('quill');
    
    // Bind native Quill directly to Yjs
    const binding = new QuillBinding(ytext, quill, awareness);
    bindingRef.current = binding;

    const workStats = ydoc.getMap('workStats');
    ytext.observe((event, transaction) => {
      if (transaction.local) {
        const addedChars = event.delta.reduce((acc: number, op: any) => {
          if (typeof op.insert === 'string') return acc + op.insert.length;
          return acc;
        }, 0);

        if (addedChars > 0) {
          const clientId = ydoc.clientID.toString();
          const localState = awareness.getLocalState()?.user;
          if (localState) {
            const currentStats: any = workStats.get(clientId) || { 
              name: localState.name, 
              color: localState.color, 
              value: 0 
            };
            
            workStats.set(clientId, {
              ...currentStats,
              name: localState.name,
              color: localState.color,
              value: currentStats.value + addedChars
            });
          }
        }
      }
    });

    return () => {
      // In StrictMode, we actually prefer to let the single instance live if the component isn't totally unmounted
      // We will only destroy if absolutely necessary, but since the parent wrapper doesn't unmount, keeping it alive fixes y-quill tracking loss.
    };
  }, [ydoc, awareness]);

  return (
    <div className="editor-container" ref={containerRef}>
    </div>
  );
};
