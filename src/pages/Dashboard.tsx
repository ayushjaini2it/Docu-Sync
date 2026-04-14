import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, registerWithEmail, loginWithEmail, logout, auth, db } from '../utils/firebase';
import type { WorkspaceRoom } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { PenTool, LogIn, LogOut, Plus, ArrowRight, Mail, LayoutGrid, Users } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
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

    // Continuous UI tick to expire offline ghosts
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!auth) return;
        const sub = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => sub();
    }, []);

    // Hook into live firestore rooms tracking
    useEffect(() => {
        if (!db || !user) return;
        const q = query(collection(db, "rooms"), where("members", "array-contains", user.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rooms: WorkspaceRoom[] = snapshot.docs.map(doc => ({
                roomId: doc.data().roomId,
                createdAt: doc.data().createdAt,
                members: doc.data().members || [],
                activeParticipants: doc.data().activeParticipants || []
            }));
            
            // Sort to display newest rooms first
            setMyRooms(rooms.sort((a,b) => b.createdAt - a.createdAt));
        }, (err) => {
            console.error("Presence Query Error:", err);
        });

        return () => unsubscribe();
    }, [user]);

    const handleCreateCustomRoom = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = customRoomName.trim();
        // Fallback to random if they submit empty form somehow, otherwise strictly use what they put
        const targetId = trimmed ? trimmed : Math.random().toString(36).substring(2, 12);
        navigate(`/room/${targetId}`);
    };

    const handleCustomRoomTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Enforce parameter alphanumeric rules
        const val = e.target.value;
        const filtered = val.replace(/[^a-zA-Z0-9_]/g, '');
        setCustomRoomName(filtered);
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinId.trim()) {
            navigate(`/room/${joinId.trim()}`);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setLoading(true);

        try {
            if (isSignUp) {
                if (!name.trim()) throw new Error("Display Name is critically required for collaborations!");
                await registerWithEmail(email, password, name.trim());
            } else {
                await loginWithEmail(email, password);
            }
        } catch (err: any) {
            console.error("Auth Exception:", err);
            const errorMsg = err.message.replace("Firebase:", "").trim();
            setAuthError(errorMsg || "An unknown authentication error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const, fontSize: '0.95rem'
    };

    // Render Auth Gate if logged out
    if (!user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: 'white', padding: '20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ width: '80px', height: '80px', background: 'var(--accent-gradient)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', boxShadow: 'var(--shadow-glow)' }}>
                        <PenTool size={40} color="white" />
                    </div>
                    <h1 style={{ fontSize: '3rem', fontFamily: "'Outfit', sans-serif", margin: 0 }}>Docu-<span className="text-gradient">Sync</span></h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '10px' }}>Real-time Collaborative Editing Platform</p>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(20px)', padding: '3rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', width: '100%', maxWidth: '420px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', boxSizing: 'border-box' }}>
                    <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif" }}>
                        {isSignUp ? "Create an Account" : "Access your Studio"}
                    </h2>

                    {authError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
                            {authError}
                        </div>
                    )}

                    <form onSubmit={handleEmailAuth} style={{ textAlign: 'left' }}>
                        {isSignUp && (
                            <input type="text" placeholder="Display Name (Your Cursors Name)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
                        )}
                        <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
                        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required />
                        
                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '8px', opacity: loading ? 0.7 : 1 }}>
                            <Mail size={18} /> {loading ? "Authenticating..." : (isSignUp ? "Sign Up" : "Sign In")}
                        </button>
                    </form>

                    <div style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {isSignUp ? "Already have an account? " : "Don't have an account? "}
                        <span onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                            {isSignUp ? "Log In" : "Sign Up"}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--text-muted)' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                        <span style={{ padding: '0 10px', fontSize: '0.85rem' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                    </div>

                    <button onClick={signInWithGoogle} style={{ width: '100%', padding: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                        <LogIn size={20} /> Continue with Google
                    </button>
                </div>
            </div>
        );
    }

    // Render Authenticated Dashboard Grid
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'white', padding: '40px' }}>
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '45px', height: '45px', background: 'var(--accent-gradient)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PenTool size={22} color="white" />
                    </div>
                    <h2 style={{ fontFamily: "'Outfit', sans-serif", margin: 0, fontSize: '1.8rem' }}>Workspace</h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.2)', padding: '8px 16px', borderRadius: '50px', border: '1px solid var(--border-subtle)' }}>
                     {user.photoURL ? (
                        <img src={user.photoURL} alt="avatar" style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
                    ) : (
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            {user.displayName?.charAt(0) || 'U'}
                        </div>
                    )}
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.displayName}</span>
                    <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 5px' }} />
                    <button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <LogOut size={16} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Exit</span>
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', alignItems: 'start' }}>
                
                {/* ACTIONS PANEL */}
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={20} className="text-primary" /> Create Room
                    </h3>
                    
                    <form onSubmit={handleCreateCustomRoom} style={{ marginBottom: '30px' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
                            Specify a unique alphanumeric name manually (no spaces/hyphens), or leave blank to instantly auto-generate.
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" 
                                placeholder="e.g. Hackathon_Business_Plan" 
                                value={customRoomName} 
                                onChange={handleCustomRoomTyping}
                                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                            />
                            <button type="submit" className="btn-primary" style={{ padding: '0 16px', borderRadius: 'var(--radius-md)' }}>
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </form>

                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '20px 0' }} />

                    <h3 style={{ margin: '0 0 20px 0', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={20} className="text-primary" /> Join Active Room
                    </h3>
                    <form onSubmit={handleJoinRoom} style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            type="text" 
                            placeholder="Paste specific Room ID..." 
                            value={joinId} 
                            onChange={(e) => setJoinId(e.target.value)}
                            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                            required
                        />
                        <button type="submit" style={{ padding: '0 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'white', cursor: 'pointer' }}>
                            <ArrowRight size={20} />
                        </button>
                    </form>
                </div>

                {/* MY ROOMS GRID */}
                <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
                    <h2 style={{ fontFamily: "'Outfit', sans-serif", borderBottom: '1px solid var(--border-subtle)', paddingBottom: '15px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LayoutGrid size={24} /> Recent Workspaces
                    </h2>

                    {myRooms.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed var(--border-subtle)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No active workspaces detected on this account.</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create a new room from the panel on the left to get started!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {myRooms.map(room => (
                                <div 
                                    key={room.roomId}
                                    onClick={() => navigate(`/room/${room.roomId}`)}
                                    style={{ 
                                        background: 'var(--surface)', 
                                        border: '1px solid var(--border-subtle)', 
                                        borderRadius: '12px', 
                                        padding: '20px', 
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-3px)';
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
                                        <div style={{ 
                                            background: 'rgba(0,0,0,0.3)', 
                                            padding: '4px 10px', 
                                            borderRadius: '6px', 
                                            fontFamily: 'monospace', 
                                            fontSize: '0.85rem',
                                            color: 'var(--text-main)',
                                            border: '1px solid var(--border-subtle)'
                                        }}>
                                            {room.roomId}
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Created: {new Date(room.createdAt).toLocaleDateString()}
                                        </div>
                                        
                                        {/* ACTIVE PRESENCE MARKER HUB */}
                                        {room.activeParticipants && room.activeParticipants.filter(p => now - p.lastActive < 35000).length > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {/* Pulsing Dot */}
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                                                <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                                                    {room.activeParticipants.filter(p => now - p.lastActive < 35000).slice(0, 3).map((p) => (
                                                        <div 
                                                            key={p.uid} 
                                                            title={`${p.displayName} is Online`}
                                                            style={{ 
                                                                width: '28px', 
                                                                height: '28px', 
                                                                borderRadius: '50%', 
                                                                background: 'var(--primary)', 
                                                                border: '2px solid var(--surface)',
                                                                marginLeft: '-10px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 'bold',
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            {p.photoURL ? (
                                                                <img src={p.photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                p.displayName.charAt(0)
                                                            )}
                                                        </div>
                                                    ))}
                                                    {room.activeParticipants.filter(p => now - p.lastActive < 35000).length > 3 && (
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface-raised)', border: '2px solid var(--surface)', marginLeft: '-10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                                            +{room.activeParticipants.filter(p => now - p.lastActive < 35000).length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
