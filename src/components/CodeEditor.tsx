import React, { useEffect, useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';

interface Props {
  ydoc: Y.Doc;
  awareness: Awareness;
  language: string;
}

export const CodeEditor: React.FC<Props> = ({ ydoc, awareness, language }) => {
  const editorRef = useRef<any>(null);
  const bindingRef = useRef<any>(null);
  const [output, setOutput] = useState<string>('');
  const [running, setRunning] = useState(false);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    const ytext = ydoc.getText('monaco');
    bindingRef.current = new MonacoBinding(ytext, editor.getModel(), new Set([editor]), awareness);
    
    // Inject custom CSS natively for remote cursor styles matching Quill sizes
    const style = document.createElement('style');
    style.innerHTML = `
      .yRemoteSelection { background-color: rgba(250, 129, 0, 0.4); }
      .yRemoteSelectionHead { position: absolute; border-left: 2px solid orange; border-top: 2px solid orange; border-bottom: 2px solid orange; }
    `;
    document.head.appendChild(style);

    // Track WorkStats exactly equivalent to the text editor!
    const workStats = ydoc.getMap('workStats');
    ytext.observe((event, transaction) => {
      if (transaction.local) {
        let addedChars = 0;
        event.delta.forEach((op: any) => {
          if (typeof op.insert === 'string') addedChars += op.insert.length;
        });

        if (addedChars > 0) {
          const clientId = ydoc.clientID.toString();
          const localState = awareness.getLocalState()?.user;
          if (localState) {
            const currentStats: any = workStats.get(clientId) || { name: localState.name, color: localState.color, value: 0 };
            workStats.set(clientId, { ...currentStats, name: localState.name, color: localState.color, value: currentStats.value + addedChars });
          }
        }
      }
    });
  };

  useEffect(() => {
    return () => {
      if (bindingRef.current) bindingRef.current.destroy();
    };
  }, []);

  const executeCode = async () => {
    if (!editorRef.current) return;
    setRunning(true);
    setOutput('Starting compiler...');
    const sourceCode = editorRef.current.getValue();

    if (language.toLowerCase() === 'javascript') {
        setTimeout(() => {
            let logs: string[] = [];
            
            // Proxy console.log to intercept the output locally
            const originalLog = console.log;
            const originalError = console.error;
            
            console.log = (...args) => {
                logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                originalLog(...args);
            };
            console.error = (...args) => {
                logs.push('[Error] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                originalError(...args);
            };

            try {
                // eslint-disable-next-line no-new-func
                const exec = new Function(sourceCode);
                exec();
                setOutput(logs.join('\n') || '> Executed successfully. (No output)');
            } catch (err: any) {
                setOutput('Exception: ' + err.message);
            } finally {
                console.log = originalLog;
                console.error = originalError;
                setRunning(false);
            }
        }, 100);
    } else {
        // Evaluate everything else utilizing reliable remote Wandbox proxies
        const compilerMap: Record<string, string> = {
            'python': 'cpython-3.14.0',
            'c++': 'gcc-13.2.0',
            'java': 'openjdk-jdk-21+35',
        };
        const targetCompiler = compilerMap[language.toLowerCase()] || 'cpython-3.14.0';

        try {
            const resp = await fetch('https://wandbox.org/api/compile.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    compiler: targetCompiler,
                    code: sourceCode
                })
            });
            const data = await resp.json();
            
            let outputBlock = '';
            if (data.compiler_error && data.compiler_error.trim()) {
                outputBlock += `[Compiler Exit]\n${data.compiler_error.trim()}\n\n`;
            }
            if (data.program_message) {
                outputBlock += data.program_message;
            }

            setOutput(outputBlock.trim() || '> Executed successfully. (No output generated)');
        } catch (err: any) {
            setOutput('Network Proxy Exception: ' + err.message + '\nMake sure you are connected to the internet.');
        } finally {
            setRunning(false);
        }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Code Editor Top Action Bar */}
      <div style={{ padding: '8px 16px', background: 'var(--surface-base)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
         <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{language.toUpperCase()} ENGINE</div>
         <button onClick={executeCode} disabled={running} style={{ padding: '6px 16px', background: '#a855f7', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: running ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem', opacity: running ? 0.7 : 1 }}>
           {running ? 'Compiling...' : 'Run Code'}
         </button>
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MonacoEditor
          height="100%"
          language={language === 'c++' ? 'cpp' : language}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            fontFamily: 'Consolas, "Courier New", monospace'
          }}
        />
      </div>

      {/* Compiler Output Console */}
      <div style={{ height: '30%', background: '#1e1e1e', borderTop: '2px solid #a855f7', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ padding: '6px 16px', background: '#252526', color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>TERMINAL OUTPUT</span>
        </div>
        <div style={{ padding: '12px', color: '#fff', fontFamily: 'Consolas, "Courier New", monospace', fontSize: '13px', overflowY: 'auto', flex: 1, whiteSpace: 'pre-wrap' }}>
          {output || '> Waiting for execution cycle...'}
        </div>
      </div>
    </div>
  );
};
