import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithGoogle, registerWithEmail, loginWithEmail, logout, auth, db, createRoom, deleteRoomAndSnapshots } from '../utils/firebase';
import type { WorkspaceRoom } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { PenTool, LogIn, LogOut, Plus, ArrowRight, Mail, Trash2, FileText, Clock, LayoutGrid, Sun, Moon, GitCommit, Code, Terminal, Activity } from 'lucide-react';
import { ThemeContext } from '../ThemeContext';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggleTheme } = useContext(ThemeContext)!;
    const [user, setUser] = useState<User | null>(auth?.currentUser || null);

    // Auth States
    const [isSignUp, setIsSignUp] = useState(location.state?.mode !== 'signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [authError, setAuthError] = useState('');
    const [loading, setLoading] = useState(false);

    // Workspace States
    const [myRooms, setMyRooms] = useState<WorkspaceRoom[]>([]);
    const [joinId, setJoinId] = useState('');
    const [customRoomName, setCustomRoomName] = useState('');
    const [codeRoomName, setCodeRoomName] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('javascript');
    const [now, setNow] = useState(Date.now());
    const [activeNav, setActiveNav] = useState<'dashboard' | 'recent' | 'contributions'>('dashboard');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!auth) return;
        const sub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => sub();
    }, []);

    useEffect(() => {
        if (!db || !user) return;
        const q = query(collection(db, 'rooms'), where('members', 'array-contains', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rooms: WorkspaceRoom[] = snapshot.docs.map(d => ({
                roomId: d.data().roomId,
                name: d.data().name || d.data().roomId,
                createdAt: d.data().createdAt,
                members: d.data().members || [],
                activeParticipants: d.data().activeParticipants || [],
                documents: d.data().documents || [{ docId: d.data().roomId, title: d.data().name || d.data().roomId, createdAt: d.data().createdAt, updatedAt: d.data().createdAt }],
                lastPreview: d.data().lastPreview || '',
                lastCommit: d.data().lastCommit || '',
                type: d.data().type,
                language: d.data().language
            }));
            setMyRooms(rooms.sort((a, b) => b.createdAt - a.createdAt));
        }, (err) => console.error('Presence Query Error:', err));
        return () => unsubscribe();
    }, [user]);

    const handleCreateText = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = customRoomName.trim();
        const targetId = trimmed || Math.random().toString(36).substring(2, 12);
        if (user) await createRoom(targetId, trimmed || targetId, user, 'text');
        setCustomRoomName('');
        navigate(`/room/${targetId}`);
    };

    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = codeRoomName.trim();
        const targetId = trimmed || Math.random().toString(36).substring(2, 12);
        if (user) await createRoom(targetId, trimmed || targetId, user, 'code', codeLanguage);
        setCodeRoomName('');
        navigate(`/room/${targetId}`);
    };

    const handleRoomNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomRoomName(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, ''));
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinId.trim()) navigate(`/room/${joinId.trim()}`);
    };

    const handleDelete = async (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        setDeletingId(roomId);
        try {
            await deleteRoomAndSnapshots(roomId);
        } catch (err) {
            console.error('Delete failed:', err);
        }
        setDeletingId(null);
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setLoading(true);
        try {
            if (isSignUp) {
                if (!name.trim()) throw new Error('A display name is required so collaborators can identify you.');
                await registerWithEmail(email, password, name.trim());
            } else {
                await loginWithEmail(email, password);
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            setAuthError(error.message?.replace('Firebase:', '').trim() || 'Authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    const activeCount = (room: WorkspaceRoom) =>
        room.activeParticipants?.filter(p => now - p.lastActive < 35000) || [];

    const totalDocuments = myRooms.reduce((sum, room) => sum + (room.documents?.length || 1), 0);

    const displayedRooms = activeNav === 'recent'
        ? [...myRooms].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10)
        : myRooms;

    if (!user) {
        return (
            <div className="auth-page">
                <div className="auth-brand">
                    <div className="auth-logo">
                        <PenTool size={20} strokeWidth={2} />
                    </div>
                    <span className="auth-brand-name">Docu<span className="auth-brand-accent">Sync</span></span>
                </div>

                <div className="auth-card">
                    <div className="auth-card-header">
                        <h1 className="auth-title">{isSignUp ? 'Create account' : 'Sign in'}</h1>
                        <p className="auth-subtitle">
                            {isSignUp ? 'Start collaborating in seconds.' : 'Welcome back. Pick up where you left off.'}
                        </p>
                    </div>

                    {authError && <div className="auth-error">{authError}</div>}

                    <form onSubmit={handleAuth} className="auth-form">
                        {isSignUp && (
                            <input className="auth-input" type="text" placeholder="Display name"
                                value={name} onChange={e => setName(e.target.value)} required />
                        )}
                        <input className="auth-input" type="email" placeholder="Email address"
                            value={email} onChange={e => setEmail(e.target.value)} required />
                        <input className="auth-input" type="password" placeholder="Password"
                            value={password} onChange={e => setPassword(e.target.value)} required />
                        <button type="submit" className="auth-btn-primary" disabled={loading}>
                            <Mail size={16} />
                            {loading ? 'Signing in…' : (isSignUp ? 'Create account' : 'Sign in')}
                        </button>
                    </form>

                    <p className="auth-switch">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button className="auth-switch-btn" onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}>
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </button>
                    </p>

                    <div className="auth-divider"><span>or</span></div>

                    <button className="auth-btn-google" onClick={signInWithGoogle}>
                        <LogIn size={16} />
                        Continue with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ws-page">
            <div className="app-layout">
                <aside className="ws-rail" style={{ padding: '24px' }}>
                    <div className="ws-rail-header">
                        <div className="ws-rail-logo"><PenTool size={18} strokeWidth={2.5} /></div>
                        <span className="ws-rail-title">DocuSync</span>
                    </div>

                    <div className="ws-nav-list">
                        <div className="ws-rail-label" style={{ marginBottom: '8px' }}>Main Menu</div>
                        <div
                            className={`ws-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
                            onClick={() => setActiveNav('dashboard')}
                            role="button"
                        >
                            <LayoutGrid size={16} /> <span>Dashboard</span>
                        </div>
                        <div
                            className={`ws-nav-item ${activeNav === 'recent' ? 'active' : ''}`}
                            onClick={() => setActiveNav('recent')}
                            role="button"
                        >
                            <FileText size={16} /> <span>Recent Docs</span>
                        </div>
                        <div
                            className={`ws-nav-item ${activeNav === 'contributions' ? 'active' : ''}`}
                            onClick={() => setActiveNav('contributions')}
                            role="button"
                        >
                            <Activity size={16} /> <span>MY contributions</span>
                        </div>
                    </div>

                    <div className="ws-rail-section" style={{ marginTop: '24px' }}>
                        <div className="ws-rail-label" style={{ marginBottom: '8px' }}>Join by ID</div>
                        <form onSubmit={handleJoin} style={{ display: 'flex', gap: '8px' }}>
                            <input
                                className="ws-input"
                                style={{ marginBottom: 0, flex: 1 }}
                                type="text"
                                placeholder="Enter doc ID"
                                value={joinId}
                                onChange={e => setJoinId(e.target.value)}
                                required
                            />
                            <button type="submit" className="ws-btn-join" title="Join">
                                <ArrowRight size={16} />
                            </button>
                        </form>
                    </div>

                    <div style={{ flex: 1 }} />

                    <div className="ws-nav-user" style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--surface-base)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                        {user.photoURL
                            ? <img src={user.photoURL} alt="avatar" className="ws-avatar-img" />
                            : <div className="ws-avatar-initial">{user.displayName?.charAt(0) || 'U'}</div>
                        }
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span className="ws-nav-username" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.displayName}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button className="ws-nav-logout" onClick={toggleTheme} title={theme === 'light' ? "Switch to dark mode" : "Switch to light mode"} style={{ padding: '6px', color: 'var(--text-muted)' }}>
                                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                            </button>
                            <button className="ws-nav-logout" onClick={logout} title="Sign out" style={{ padding: '6px', color: 'var(--text-muted)' }}>
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="ws-main" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="ws-main-top">
                        <span>Workspace</span>
                        <span style={{ padding: '0 4px', color: '#cbd5e1' }}>/</span>
                        <span className="ws-main-top-active">
                            {activeNav === 'dashboard' ? 'Dashboard' : activeNav === 'recent' ? 'Recent Docs' : 'MY contributions'}
                        </span>
                    </div>

                    {activeNav === 'dashboard' && (
                        <>
                            <div className="ws-main-header" style={{ marginBottom: '24px' }}>
                                <h1 className="ws-main-title">Start a new project</h1>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
                                <div style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '8px', borderRadius: '8px' }}>
                                            <FileText size={20} />
                                        </div>
                                        <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>Text Document</h2>
                                    </div>
                                    <form onSubmit={handleCreateText} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <input
                                            className="ws-input"
                                            type="text"
                                            placeholder="Enter document ID (required)"
                                            value={customRoomName}
                                            onChange={handleRoomNameInput}
                                            required
                                        />
                                        <button type="submit" className="ws-btn-create" style={{ display: 'flex', justifyContent: 'center', opacity: customRoomName.trim() ? 1 : 0.6, cursor: customRoomName.trim() ? 'pointer' : 'not-allowed' }} disabled={!customRoomName.trim()}>
                                            <Plus size={16} /> Create Document
                                        </button>
                                    </form>
                                </div>

                                <div style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '8px', borderRadius: '8px' }}>
                                            <Code size={20} />
                                        </div>
                                        <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>Code Project</h2>
                                    </div>
                                    <form onSubmit={handleCreateCode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                className="ws-input"
                                                style={{ flex: 1, marginBottom: 0 }}
                                                type="text"
                                                placeholder="Enter project ID (required)"
                                                value={codeRoomName}
                                                onChange={e => setCodeRoomName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                                required
                                            />
                                            <select
                                                className="ws-input"
                                                style={{ width: '110px', marginBottom: 0 }}
                                                value={codeLanguage}
                                                onChange={e => setCodeLanguage(e.target.value)}
                                            >
                                                <option value="javascript">JavaScript</option>
                                                <option value="python">Python</option>
                                                <option value="java">Java</option>
                                                <option value="c++">C++</option>
                                            </select>
                                        </div>
                                        <button type="submit" className="ws-btn-create" style={{ display: 'flex', justifyContent: 'center', background: '#a855f7', color: '#fff', opacity: codeRoomName.trim() ? 1 : 0.6, cursor: codeRoomName.trim() ? 'pointer' : 'not-allowed' }} disabled={!codeRoomName.trim()}>
                                            <Terminal size={16} /> Create Code Project
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </>
                    )}

                    {activeNav === 'contributions' ? (
                        <div style={{ flex: 1, paddingRight: '12px', marginTop: '16px' }}>
                            <div className="ws-main-header" style={{ marginBottom: '24px' }}>
                                <h1 className="ws-main-title">MY contributions</h1>
                                <span className="ws-doc-count">Summary list of all your content</span>
                            </div>

                            {myRooms.length === 0 ? (
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No contributions yet.</div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                    {myRooms.map(room => (
                                        <div key={room.roomId} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', background: 'var(--surface-base)' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {room.type === 'code' ? <Code size={16} color="#a855f7" /> : <FileText size={16} color="#38bdf8" />}
                                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.name && room.name !== room.roomId ? room.name : room.roomId}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                                    {room.documents?.length || 1} doc{(room.documents?.length || 1) !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {(room.documents || [{ docId: room.roomId, title: room.name || room.roomId }]).map(doc => (
                                                    <div key={doc.docId} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
                                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} onClick={() => navigate(`/room/${room.roomId}?doc=${encodeURIComponent(doc.docId)}`)} className="ws-card-preview" >{doc.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="ws-main-header">
                                <h1 className="ws-main-title">
                                    {activeNav === 'dashboard' ? 'Your documents' : 'Recent documents'}
                                </h1>
                                <span className="ws-doc-count">{myRooms.length} room{myRooms.length !== 1 ? 's' : ''} · {totalDocuments} document{totalDocuments !== 1 ? 's' : ''}</span>
                            </div>

                            {displayedRooms.length === 0 ? (
                                <div className="ws-empty" style={{ flex: 1 }}>
                                    <FileText size={48} strokeWidth={1} />
                                    <p>No documents yet.</p>
                                    <span>Create your first document using the panel on the left.</span>
                                </div>
                            ) : (
                                <div className="ws-grid">
                                    {displayedRooms.map(room => {
                                        const online = activeCount(room);
                                        const isDeleting = deletingId === room.roomId;
                                        return (
                                            <div
                                                key={room.roomId}
                                                className={`ws-card ${isDeleting ? 'ws-card-deleting' : ''}`}
                                                onClick={() => !isDeleting && navigate(`/room/${room.roomId}`)}
                                            >
                                                <div className="ws-card-top">
                                                    <div className="ws-card-icon" style={{ color: room.type === 'code' ? '#a855f7' : '#cbd5e1' }}>
                                                        {room.type === 'code' ? <Code size={18} strokeWidth={2} /> : <FileText size={18} strokeWidth={2} />}
                                                    </div>
                                                    <button
                                                        className="ws-card-delete"
                                                        onClick={e => handleDelete(e, room.roomId)}
                                                        title="Delete document and all its history"
                                                        disabled={isDeleting}
                                                    >
                                                        {isDeleting
                                                            ? <span style={{ width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                                                            : <span style={{ display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></span>
                                                        }
                                                    </button>
                                                </div>

                                                <div className="ws-card-name" style={{ marginTop: '4px' }}>
                                                    {room.name && room.name !== room.roomId ? room.name : room.roomId}
                                                </div>

                                                {room.lastPreview && (
                                                    <div className="ws-card-preview">{room.lastPreview}</div>
                                                )}

                                                {room.lastCommit && (
                                                    <div className="ws-card-last-commit">
                                                        <GitCommit size={11} />
                                                        {room.lastCommit}
                                                    </div>
                                                )}

                                                <div className="ws-card-footer">
                                                    <span className="ws-card-date">
                                                        <Clock size={11} /> {new Date(room.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className="ws-card-doc-count" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {room.documents?.length || 1} document{(room.documents?.length || 1) !== 1 ? 's' : ''}
                                                    </span>

                                                    {online.length > 0 && (
                                                        <div className="ws-card-online">
                                                            <span className="ws-card-pulse" />
                                                            <div className="ws-card-avatars">
                                                                {online.slice(0, 3).map(p => (
                                                                    <div key={p.uid} className="ws-card-avatar" title={`${p.displayName} is online`}>
                                                                        {p.photoURL
                                                                            ? <img src={p.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                                            : p.displayName.charAt(0)
                                                                        }
                                                                    </div>
                                                                ))}
                                                                {online.length > 3 && (
                                                                    <div className="ws-card-avatar ws-card-avatar-more">+{online.length - 3}</div>
                                                                )}
                                                            </div>
                                                            <span className="ws-card-online-label">{online.length} online</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};