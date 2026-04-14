import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { getSnapshots, saveSnapshot, type DocumentSnapshot } from '../utils/firebase';
import { Clock, RefreshCw } from 'lucide-react';

interface Props {
  ydoc: Y.Doc;
  roomId: string;
}

export const VersionHistory: React.FC<Props> = ({ ydoc, roomId }) => {
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const data = await getSnapshots(roomId);
      setSnapshots(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const handleSaveSnapshot = async () => {
    try {
      const updateBlob = Y.encodeStateAsUpdate(ydoc);
      const ytext = ydoc.getText('quill');
      const textVal = ytext.toString();
      console.log('SAVE SNAPSHOT CLICKED:', { textVal, ytextLength: ytext.length, updateBlobSize: updateBlob.byteLength });
      
      const preview = (textVal.trim() || 'Empty Document').substring(0, 40) + '...';

      await saveSnapshot(roomId, preview, updateBlob);
      fetchSnapshots(); 
    } catch (err) {
      console.error('SAVE SNAPSHOT FAILED:', err);
    }
  };

  const handleRestore = (updateDataB64: string) => {
    // Note: removed window.confirm block so Time Travel operates seamlessly
    const binaryString = atob(updateDataB64);
    const updateBlob = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      updateBlob[i] = binaryString.charCodeAt(i);
    }

    try {
      console.log('RESTORE CLICKED for snapshot');
      const ytext = ydoc.getText('quill');
      console.log('Current Text length:', ytext.length);
      
      // We must clear existing text. Quill always has at least 1 length (a newline)
      if (ytext.length > 0) {
        ytext.delete(0, ytext.length); 
      }
      
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, updateBlob);
      const oldDelta = tempDoc.getText('quill').toDelta();
      console.log('Old Delta to apply:', oldDelta);
      
      ytext.applyDelta(oldDelta);
      console.log('Restore successfully applied');
    } catch (err) {
      console.error('RESTORE FAILED:', err);
    }
  };

  return (
    <div className="version-sidebar">
      <div className="version-header">
        <Clock size={20} />
        <h2>Time-Travel</h2>
      </div>
      
      <button className="btn-primary" onClick={handleSaveSnapshot}>
        Save Snapshot Now
      </button>
      
      <div className="snapshots-list">
        {loading && <p>Loading...</p>}
        {snapshots.map(s => (
          <div key={s.id} className="snapshot-card">
            <div className="snap-time">
              {s.createdAt.toLocaleTimeString()} - {s.createdAt.toLocaleDateString()}
            </div>
            <div className="snap-preview">"{s.previewText}"</div>
            <button className="btn-restore" onClick={() => handleRestore(s.updateData)}>
              <RefreshCw size={14} /> Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
