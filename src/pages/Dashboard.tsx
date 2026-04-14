import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, registerWithEmail, loginWithEmail, logout, auth, db } from '../utils/firebase';
import type { WorkspaceRoom } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { PenTool, LogIn, LogOut, Plus, ArrowRight, Mail, Trash2, FileText, Clock, LayoutGrid, Sun, Moon } from 'lucide-react';
import { ThemeContext } from '../App';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useContext(ThemeContext)!;
    const [user, setUser] = useState<User | null>(auth?.currentUser || null);

    // Auth States
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [authError, setAuthError] = useState('');
    const [loading, setLoading] = useState(false);

    // Workspace States
    const [myRooms, setMyRooms] = useState<WorkspaceRoom[]>([]);
    const [joinId, setJoinId] = useState('');
    const [customRoomName, setCustomRoomName] = useState('');
    const [now, setNow] = useState(Date.now());

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
                createdAt: d.data().createdAt,
                members: d.data().members || [],
                activeParticipants: d.data().activeParticipants || []
            }));
            setMyRooms(rooms.sort((a, b) => b.createdAt - a.createdAt));
        }, (err) => console.error('Presence Query Error:', err));
        return () => unsubscribe();
    }, [user]);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = customRoomName.trim();
        const targetId = trimmed || Math.random().toString(36).substring(2, 12);
        navigate(`/room/${targetId}`);
    };

    const handleRoomNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomRoomName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''));
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinId.trim()) navigate(`/room/${joinId.trim()}`);
    };

    const handleDelete = async (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        if (!db) return;
        try { await deleteDoc(doc(db, 'rooms', roomId)); }
        catch (err) { console.error('Delete failed:', err); }
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
        } catch (err: any) {
            setAuthError(err.message.replace('Firebase:', '').trim() || 'Authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    const activeCount = (room: WorkspaceRoom) =>
        room.activeParticipants?.filter(p => now - p.lastActive < 35000) || [];

    // ─── AUTH PAGE ────────────────────────────────────────────────────────────
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

    // ─── WORKSPACE DASHBOARD ─────────────────────────────────────────────────
    return (
        <div className="ws-page">
            <div className="app-layout">
                {/* Unified Left Sidebar */}
                <aside className="ws-rail" style={{ padding: '24px' }}>
                    <div className="ws-rail-header">
                        <div className="ws-rail-logo"><PenTool size={18} strokeWidth={2.5} /></div>
                        <span className="ws-rail-title">DocuSync</span>
                    </div>

                    <div className="ws-nav-list">
                        <div className="ws-rail-label" style={{ marginBottom: '8px' }}>Main Menu</div>
                        <div className="ws-nav-item active">
                            <LayoutGrid size={16} /> <span>Dashboard</span>
                        </div>
                        <div className="ws-nav-item">
                            <FileText size={16} /> <span>Recent Docs</span>
                        </div>
                    </div>

                    <div className="ws-rail-section" style={{ marginTop: '24px' }}>
                        <div className="ws-rail-label" style={{ marginBottom: '8px' }}>Start Collaborating</div>
                        <form onSubmit={handleCreate}>
                            <input
                                className="ws-input"
                                type="text"
                                placeholder="Project proposal"
                                value={customRoomName}
                                onChange={handleRoomNameInput}
                            />
                            <p className="ws-input-hint" style={{ marginTop: '6px', marginBottom: '10px' }}>Letters/numbers only.</p>
                            <button type="submit" className="ws-btn-create">
                                <Plus size={15} /> New document
                            </button>
                        </form>
                    </div>

                    <div className="ws-rail-section" style={{ marginTop: '24px' }}>
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

                {/* Main Content Area */}
                <main className="ws-main" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="ws-main-top">
                        <span>Workspace</span> <span style={{ padding: '0 4px', color: '#cbd5e1' }}>/</span> <span className="ws-main-top-active">Dashboard</span>
                    </div>

                    <div className="ws-main-header">
                        <h1 className="ws-main-title">Your documents</h1>
                    </div>

                    {myRooms.length === 0 ? (
                        <div className="ws-empty" style={{ flex: 1 }}>
                            <FileText size={48} strokeWidth={1} />
                            <p>No documents yet.</p>
                            <span>Create your first document using the panel on the left.</span>
                        </div>
                    ) : (
                        <div className="ws-grid">
                            {myRooms.map(room => {
                                const online = activeCount(room);
                                return (
                                    <div
                                        key={room.roomId}
                                        className="ws-card"
                                        onClick={() => navigate(`/room/${room.roomId}`)}
                                    >
                                        <div className="ws-card-top">
                                            <div className="ws-card-icon"><FileText size={18} strokeWidth={2} /></div>
                                            <button
                                                className="ws-card-delete"
                                                onClick={e => handleDelete(e, room.roomId)}
                                                title="Delete room"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>

                                        <div className="ws-card-name" style={{ marginTop: '4px' }}>{room.roomId}</div>

                                        <div className="ws-card-footer">
                                            <span className="ws-card-date">
                                                <Clock size={11} /> {new Date(room.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
