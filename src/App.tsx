import React, { useState, useEffect, FormEvent } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  query,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import FeedPage from './components/FeedPage';
import { 
  User, 
  Rss, 
  Image as ImageIcon, 
  GraduationCap, 
  MapPin, 
  Phone, 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  LogOut, 
  Compass, 
  Tv, 
  Heart,
  CheckCircle,
  Copy,
  ExternalLink,
  X,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Static seed photos for Gallery display
const DEFAULT_GALLERY_ITEMS = [
  {
    id: 'static-1',
    title: 'Dhaka Jatiyo Sangsad Bhaban',
    category: 'Dhaka' as const,
    url: 'https://images.unsplash.com/photo-1581579186913-45ac3e6efe93?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'static-2',
    title: 'Cyberpunk Developer Setup',
    category: 'Coding' as const,
    url: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'static-3',
    title: 'Aesthetic Anime Sky',
    category: 'Anime' as const,
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'static-4',
    title: 'Dhaka Street Rickshaws',
    category: 'Dhaka' as const,
    url: 'https://images.unsplash.com/photo-1596422846543-75c6fc18a523?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'static-5',
    title: 'Modern Web Architecture',
    category: 'Coding' as const,
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'static-6',
    title: 'Shibuya Crossing Neon Night',
    category: 'Anime' as const,
    url: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=600&q=80'
  }
];

export default function App() {
  const [activePage, setActivePage] = useState<'home' | 'feed' | 'gallery' | 'hobbies'>('home');
  const [accent, setAccent] = useState<'cyan' | 'rose' | 'emerald'>('cyan');
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user'>('user');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Auth Form Fields
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // Image lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState('');

  // Feed count for bio stats
  const [statsPostsCount, setStatsPostsCount] = useState(3);
  const [dbImages, setDbImages] = useState<{ id: string, title: string, category: 'All' | 'Anime' | 'Coding' | 'Dhaka', url: string }[]>([]);

  // Toast System
  const [toasts, setToasts] = useState<{ id: string, title: string, msg: string, type: 'success' | 'error' | 'info' }[]>([]);

  const triggerToast = (title: string, msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, title, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Sync Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Custom verification to set admin
        const isAdminEmail = user.email === 'siyamrahman1268@gmail.com';
        const assessedRole = isAdminEmail ? 'admin' : 'user';
        setUserRole(assessedRole);

        // Store user details in users schema
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (!userSnap.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous Developer',
              email: user.email || '',
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email || 'Siyam'}`,
              role: assessedRole,
              createdAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("User mapping failed:", err);
        }
      } else {
        setCurrentUser(null);
        setUserRole('user');
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch count stats and media gallery items dynamically from active DB posts with pictures
  useEffect(() => {
    const q = query(collection(db, 'posts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStatsPostsCount(snapshot.size);
      
      const images: any[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        if (d.imageUrl) {
          images.push({
            id: `db-${doc.id}`,
            title: `Shared by ${d.authorName || 'User'}`,
            category: d.category || 'Coding',
            url: d.imageUrl
          });
        }
      });
      setDbImages(images);
    }, (error) => {
      console.warn("Real-time stats tracking bypass:", error);
    });

    return () => unsubscribe();
  }, []);

  // Custom accent themes map config
  const accentStyles = {
    cyan: {
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
      borderHover: 'hover:border-cyan-400',
      tag: 'text-cyan-400 border-cyan-500/20 bg-cyan-950/30',
      badge: 'bg-cyan-500 text-slate-950',
      bgGlow: 'bg-cyan-900/10',
      gradient: 'from-cyan-400 via-indigo-400 to-rose-400',
      btn: 'bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 shadow-cyan-500/20 hover:shadow-cyan-400/30',
      dot: 'bg-cyan-500'
    },
    rose: {
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      borderHover: 'hover:border-rose-400',
      tag: 'text-rose-400 border-rose-500/20 bg-rose-950/30',
      badge: 'bg-rose-500 text-slate-950',
      bgGlow: 'bg-rose-900/10',
      gradient: 'from-rose-400 via-purple-400 to-amber-400',
      btn: 'bg-gradient-to-r from-rose-400 to-purple-500 text-slate-950 shadow-rose-500/20 hover:shadow-rose-400/30',
      dot: 'bg-rose-500'
    },
    emerald: {
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      borderHover: 'hover:border-emerald-400',
      tag: 'text-emerald-400 border-emerald-500/20 bg-emerald-950/30',
      badge: 'bg-emerald-500 text-slate-950',
      bgGlow: 'bg-emerald-950/10',
      gradient: 'from-emerald-400 via-teal-400 to-sky-400',
      btn: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-emerald-500/20 hover:shadow-emerald-400/30',
      dot: 'bg-emerald-500'
    }
  };

  const activeTheme = accentStyles[accent];

  // Manual Email signup/login routines
  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      if (authMode === 'signup') {
        if (!authName.trim()) {
          throw new Error('Please input your display name first.');
        }
        const credential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${authEmail.toLowerCase()}`;
        
        await updateProfile(credential.user, {
          displayName: authName,
          photoURL: avatarUrl
        });

        // Write users collection
        await setDoc(doc(db, 'users', credential.user.uid), {
          uid: credential.user.uid,
          displayName: authName,
          email: authEmail.toLowerCase(),
          photoURL: avatarUrl,
          role: authEmail.toLowerCase() === 'siyamrahman1268@gmail.com' ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        });

        triggerToast('Account Created', `Greetings, ${authName}! Welcome to Siyam's dynamic room.`, 'success');
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        triggerToast('Welcome Back', 'Successfully authenticated securely!', 'success');
      }
      setIsAuthModalOpen(false);
      
      // Clear inputs
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err: any) {
      setAuthError(err?.message || 'Transaction aborted.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      
      triggerToast('Google Connected', `Signed in successfully as ${res.user.displayName}`, 'success');
      setIsAuthModalOpen(false);
    } catch (err: any) {
      triggerToast('Google Fail', err?.message || 'Authentication failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      triggerToast('Logged Out', 'Your session was cleared. Secure offline status.', 'info');
    } catch (err) {
      triggerToast('Signout error', 'Failed to release sessions.', 'error');
    }
  };

  const copyPublicUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    triggerToast('URL Copied', 'The image secure cloud address was copied to your clipboard!', 'success');
  };

  // Gallery render combines static seeds and dynamic uploader assets
  const combinedGallery = [...DEFAULT_GALLERY_ITEMS, ...dbImages];
  const [selectedGalleryCat, setSelectedGalleryCat] = useState<'All' | 'Anime' | 'Coding' | 'Dhaka'>('All');
  const filteredGallery = selectedGalleryCat === 'All' 
    ? combinedGallery 
    : combinedGallery.filter(item => item.category === selectedGalleryCat);

  return (
    <div className="bg-[#02050E] text-slate-100 font-sans min-h-screen relative overflow-x-hidden flex flex-col justify-between">
      
      {/* GLOW BACKGROUND SPOTS */}
      <div className={`fixed top-[-10%] left-[-15%] w-[55vw] h-[55vw] rounded-full blur-[130px] pointer-events-none animate-float-slow -z-10 transition-colors duration-1000 ${activeTheme.bgGlow}`}></div>
      <div className={`fixed bottom-[-10%] right-[-15%] w-[60vw] h-[60vw] rounded-full blur-[150px] pointer-events-none animate-float-reverse -z-10 transition-colors duration-1000 ${activeTheme.bgGlow}`}></div>

      {/* REACT TOAST NOTIFIER FLOATING */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-3 max-w-sm w-full px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 50 }}
              key={toast.id}
              className="glass-panel p-4 rounded-xl border border-white/10 flex items-start gap-3 shadow-2xl relative overflow-hidden"
            >
              <div className={`w-1.5 absolute left-0 top-0 bottom-0 ${
                toast.type === 'success' ? 'bg-emerald-400' : toast.type === 'error' ? 'bg-red-400' : 'bg-cyan-400'
              }`} />
              <div className="flex-1 text-left select-none pl-1">
                <span className="block text-xs font-bold text-white uppercase tracking-wider">{toast.title}</span>
                <span className="block text-xs text-slate-300 font-sans mt-0.5">{toast.msg}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* STICKY GLASS HEADER */}
      <header className="sticky top-0 z-50 w-full bg-[#02050E]/75 backdrop-blur-xl border-b border-white/5 transition duration-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          
          <button onClick={() => setActivePage('home')} className="flex items-center gap-3 group text-left cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 p-[1.5px] shadow-lg shadow-cyan-500/10 group-hover:shadow-cyan-500/20 transition-all duration-300">
              <div className="w-full h-full bg-[#050917] rounded-[10px] flex items-center justify-center">
                <span className="text-xs sm:text-sm font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">&lt;S/&gt;</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-display text-sm sm:text-base font-bold tracking-tight">Sahedur Rahman Siyam</span>
              <span className="text-cyan-500 font-mono text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold">Dhaka, BD &middot; Class 12</span>
            </div>
          </button>

          {/* Nav Links mapping dedicated pages */}
          <nav className="hidden md:flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-4 py-2 rounded-full backdrop-blur-md font-sans">
            <button 
              onClick={() => setActivePage('home')} 
              className={`px-3.5 py-1 text-xs sm:text-sm transition rounded-full font-medium cursor-pointer ${
                activePage === 'home' ? 'bg-white/5 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Home
            </button>
            <button 
              onClick={() => setActivePage('feed')} 
              className={`px-3.5 py-1 text-xs sm:text-sm transition rounded-full font-medium cursor-pointer ${
                activePage === 'feed' ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Siyam's Feed
            </button>
            <button 
              onClick={() => setActivePage('gallery')} 
              className={`px-3.5 py-1 text-xs sm:text-sm transition rounded-full font-medium cursor-pointer ${
                activePage === 'gallery' ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Media Gallery
            </button>
            <button 
              onClick={() => setActivePage('hobbies')} 
              className={`px-3.5 py-1 text-xs sm:text-sm transition rounded-full font-medium cursor-pointer ${
                activePage === 'hobbies' ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              My Hobbies
            </button>
          </nav>

          {/* User Signin details or launcher */}
          <div className="flex items-center gap-3">
            
            {/* Palette selection selectors */}
            <div className="flex items-center gap-1.5 bg-slate-950/60 border border-white/5 px-2 py-1.5 rounded-full shadow-inner">
              <button 
                onClick={() => setAccent('cyan')} 
                className={`w-3 h-3 rounded-full bg-cyan-500 transition scale-90 hover:scale-110 cursor-pointer ${accent === 'cyan' && 'scale-125 ring-2 ring-white/50'}`}
                title="Cyber Cyan Theme"
              />
              <button 
                onClick={() => setAccent('rose')} 
                className={`w-3 h-3 rounded-full bg-rose-500 transition scale-90 hover:scale-110 cursor-pointer ${accent === 'rose' && 'scale-125 ring-2 ring-white/50'}`}
                title="Cosmic Rose Theme"
              />
              <button 
                onClick={() => setAccent('emerald')} 
                className={`w-3 h-3 rounded-full bg-emerald-500 transition scale-90 hover:scale-110 cursor-pointer ${accent === 'emerald' && 'scale-125 ring-2 ring-white/50'}`}
                title="Matrix Jade Theme"
              />
            </div>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-200">{currentUser.displayName || 'Developer'}</span>
                  <span className="text-[9px] font-mono text-cyan-400 truncate max-w-[120px]">{currentUser.email}</span>
                </div>
                <img 
                  src={currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.email}`}
                  className="w-8 h-8 rounded-full border border-white/10"
                  alt="Profile"
                  title={currentUser.email}
                />
                <button
                  onClick={handleSignOut}
                  className="p-1 px-2.5 bg-slate-900 hover:bg-red-950/30 text-rose-400 text-xs font-medium border border-white/5 hover:border-red-900/30 rounded-full transition cursor-pointer"
                  title="Logout Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('signin');
                  setIsAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1 bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 px-4 py-2 rounded-full text-xs font-bold hover:opacity-90 active:scale-95 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In / Sign Up
              </button>
            )}

          </div>
        </div>

        {/* Mobile quick header menu bar */}
        <div className="md:hidden flex items-center justify-around h-11 bg-slate-950/40 border-t border-b border-white/5 text-[10px] font-mono font-medium">
          <button onClick={() => setActivePage('home')} className={`flex items-center gap-1 ${activePage === 'home' ? 'text-cyan-400' : 'text-slate-400'}`}><User className="w-3.5 h-3.5" /> Home</button>
          <button onClick={() => setActivePage('feed')} className={`flex items-center gap-1 ${activePage === 'feed' ? 'text-cyan-400' : 'text-slate-400'}`}><Rss className="w-3.5 h-3.5" /> Feed</button>
          <button onClick={() => setActivePage('gallery')} className={`flex items-center gap-1 ${activePage === 'gallery' ? 'text-cyan-400' : 'text-slate-400'}`}><ImageIcon className="w-3.5 h-3.5" /> Gallery</button>
          <button onClick={() => setActivePage('hobbies')} className={`flex items-center gap-1 ${activePage === 'hobbies' ? 'text-cyan-400' : 'text-slate-400'}`}><Compass className="w-3.5 h-3.5" /> Hobbies</button>
        </div>
      </header>

      {/* PRIMARY VIEWER CONTAINER */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.01, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            
            {/* ABOUT / PORTFOLIO PAGE */}
            {activePage === 'home' && (
              <div className="space-y-16">
                
                {/* HERO CORE */}
                <section className="min-h-[60vh] flex flex-col md:flex-row items-center justify-between gap-12 text-left pt-6">
                  <div className="flex-1 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10">
                      <span className={`w-2 h-2 rounded-full ${activeTheme.dot} animate-pulse`} />
                      <span className="text-[10px] sm:text-xs font-mono font-medium text-slate-300 tracking-wider">
                        Dhaka, BD &bull; Class 12 Hobbies & Feed App
                      </span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight leading-none text-white select-none">
                      Hello, I am <br />
                      <span className={`text-transparent bg-clip-text bg-gradient-to-r ${activeTheme.gradient} text-glowing`}>
                        Sahedur Rahman Siyam
                      </span>
                    </h1>

                    <p className="text-sm sm:text-base text-slate-300 font-light leading-relaxed max-w-xl">
                      I am a highly motivated Class 12 student living in Dhaka, Bangladesh. I hold a magnificent passion for configuring modern database schemas, web development styles, computing mechanics, and high-contrast glassmorphism visual templates.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="flex items-center gap-1.5 bg-[#050917] hover:bg-slate-900 border border-white/5 py-1.5 px-3.5 rounded-lg text-xs text-slate-300 font-mono">
                        <MapPin className="w-4 h-4 text-cyan-400" /> Dhaka, Bangladesh
                      </span>
                      <span className="flex items-center gap-1.5 bg-[#050917] hover:bg-slate-900 border border-white/5 py-1.5 px-3.5 rounded-lg text-xs text-slate-300 font-mono">
                        <GraduationCap className="w-4 h-4 text-fuchsia-400" /> Class 12 Studies
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button 
                        onClick={() => setActivePage('feed')}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm hover:brightness-110 active:scale-95 transition select-none cursor-pointer ${activeTheme.btn}`}
                      >
                        <Rss className="w-4 h-4" /> Go to Siyam's Feed
                      </button>
                      
                      <button 
                        onClick={() => setActivePage('gallery')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-white/5 text-slate-300 border border-white/10 hover:border-white/20 active:scale-95 text-xs sm:text-sm rounded-full transition cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4" /> Browse Photo Vault
                      </button>
                    </div>
                  </div>

                  {/* High Quality Bento Bio card */}
                  <div className="w-full md:w-[350px] shrink-0">
                    <div className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col gap-6">
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>

                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-base">
                          SRS
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest leading-none mb-1">CODENAME: SIYAM</p>
                          <p className="text-sm font-bold text-slate-100">Dhaka Portfolio</p>
                        </div>
                      </div>

                      <div className="space-y-3.5 text-xs text-slate-300 text-left">
                        <div className="bg-slate-950/40 p-2.5 border border-white/5 rounded-xl">
                          <span className="font-bold text-slate-100 block mb-0.5">Coding Interest</span>
                          <span className="text-[11px] text-slate-400 leading-normal">Building beautiful functional frontends connected instantly to live Firestore servers.</span>
                        </div>
                        <div className="bg-slate-950/40 p-2.5 border border-white/5 rounded-xl">
                          <span className="font-bold text-slate-100 block mb-0.5">Media & Entertainment</span>
                          <span className="text-[11px] text-slate-400 leading-normal">Deep passion for Anime loops, bingeable Korean Dramas, immersive films, and responsive gaming channels.</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-center border-t border-white/5">
                        <div className="bg-[#050811] border border-white/5 p-2 rounded-xl">
                          <span className="block text-lg font-display font-extrabold text-white">Class 12</span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Aspirant</span>
                        </div>
                        <div className="bg-[#050811] border border-white/5 p-2 rounded-xl">
                          <span className="block text-lg font-display font-extrabold text-cyan-400">{statsPostsCount}</span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Active Posts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* HOBBIES SUMMARY */}
                <section className="space-y-6">
                  <div className="text-left">
                    <h3 className="text-lg font-mono font-bold text-slate-400 uppercase tracking-widest">Quick Snapshot Preview</h3>
                    <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">Interests & Hobbies Dashboard</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                      <Tv className="w-8 h-8 text-cyan-400" />
                      <h4 className="text-base font-bold text-slate-100">Anime & Korean Dramas</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-light">
                        Anime story lines and Korean dramas feed my creative drive. These emotional narrative arcs help design elegant pacing on custom user flows!
                      </p>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                      <Compass className="w-8 h-8 text-indigo-400" />
                      <h4 className="text-base font-bold text-slate-100">Web Architectures</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-light">
                        I love learning React state lifecycles, full-stack microservers, Firebase Authentication, secure SDK configurations, and Tailwind styling parameters.
                      </p>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                      <Sparkles className="w-8 h-8 text-yellow-400" />
                      <h4 className="text-base font-bold text-slate-100">Responsive Designing</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-light">
                        Translating user requirements into liquid responsive UI components is my forte. No raw details are skipped in styling.
                      </p>
                    </div>
                  </div>
                </section>

                {/* DIRECT PHONE CALL / CONTACT */}
                <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 text-left relative overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl"></div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-8 space-y-3">
                      <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white">Need to reach Sahedur directly?</h3>
                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        I am based in Dhaka, active and looking for exciting collaborations. You can call my cellular direct line or contact Siyam via messenger triggers.
                      </p>
                    </div>
                    <div className="md:col-span-4 flex flex-col sm:flex-row gap-3 md:justify-end">
                      <a 
                        href="tel:01703002699" 
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-400 via-indigo-500 to-rose-400 font-bold text-xs sm:text-sm text-slate-950 rounded-full hover:brightness-110 active:scale-95 transition"
                      >
                        <PhoneCall className="w-4 h-4" /> Call 01703002699
                      </a>
                    </div>
                  </div>
                </section>

              </div>
            )}

            {/* DEDICATED FEED PAGE */}
            {activePage === 'feed' && (
              <FeedPage 
                isAdmin={userRole === 'admin'}
                currentUser={currentUser}
                onViewImage={(url, title) => {
                  setLightboxUrl(url);
                  setLightboxTitle(title);
                }}
                triggerToast={triggerToast}
              />
            )}

            {/* MEDIA GALLERY */}
            {activePage === 'gallery' && (
              <div className="space-y-6 text-left">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">Cloud Media Vault</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    An automated image board compiled in real-time. Includes seed assets and files attached to social posts in our database.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-b border-white/5 py-3 font-mono">
                  <div className="text-xs text-slate-400">
                    Showing <span className="text-cyan-400 font-bold">{filteredGallery.length}</span> cloud graphics
                  </div>

                  <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 border border-white/5 rounded-xl">
                    {(['All', 'Anime', 'Coding', 'Dhaka'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedGalleryCat(cat)}
                        className={`px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                          selectedGalleryCat === cat
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        #{cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredGallery.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {filteredGallery.map((item) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          key={item.id}
                          className="glass-panel p-3 rounded-2xl border border-white/10 group cursor-pointer"
                          onClick={() => {
                            setLightboxUrl(item.url);
                            setLightboxTitle(item.title);
                          }}
                        >
                          <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-950/60 flex items-center justify-center">
                            <img 
                              src={item.url} 
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                              alt={item.title} 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-3">
                              <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800/40 px-2.5 py-1 rounded">
                                Click to Expand
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 text-left pl-1">
                            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest text-[10px]">#{item.category}</span>
                            <p className="text-sm font-bold text-slate-200 truncate mt-0.5">{item.title}</p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="glass-panel py-20 rounded-3xl border border-dashed border-white/10 text-center">
                    <span className="text-slate-500 block mb-2 font-mono text-sm leading-none">EMPTY CATEGORY INDEX</span>
                    <p className="text-xs text-slate-400">Write high quality post attachments inside Siyam's Feed under #{selectedGalleryCat} to trigger uploads.</p>
                  </div>
                )}
              </div>
            )}

            {/* HOBBIES PAGE */}
            {activePage === 'hobbies' && (
              <div className="space-y-12 text-left">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">Siyam's Interests & Hobbies</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Exploring narrative graphics, emotional music channels, and high-fidelity computing structures.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                  <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <Tv className="w-8 h-8 text-rose-400 animate-pulse" />
                      <h3 className="text-lg font-bold text-slate-100">Anime, K-Drama & Entertainment</h3>
                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light">
                        I spend my study-breaks engaging with Japanese Anime, emotional Korean Dramas, and narrative cinema. Exploring these creative mediums teaches me formatting, cinematic transitions, and color palette alignments which I apply to frontend layouts!
                      </p>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex flex-wrap gap-2 text-xs font-mono">
                      <span className="text-rose-400 bg-rose-950/30 px-2 py-0.5 rounded">#ShinkaiFan</span>
                      <span className="text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded">#AestheticLoops</span>
                      <span className="text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded">#K-DramaBinge</span>
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <Sparkles className="w-8 h-8 text-emerald-400" />
                      <h3 className="text-lg font-bold text-slate-100">Computing Network Operations</h3>
                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light">
                        Understanding how API requests propagate from user interfaces via CDN routers into isolated Firestore databases is extremely fascinating. Building custom web apps connected to databases is my primary hobby!
                      </p>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex flex-wrap gap-2 text-xs font-mono">
                      <span className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded">#FullStackLover</span>
                      <span className="text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded">#FirestoreSync</span>
                      <span className="text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded">#VerifiedAdmin</span>
                    </div>
                  </div>
                </div>

                {/* Additional interactive hobby slider card */}
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-mono text-cyan-400 uppercase tracking-widest font-bold">Class 12 Academic Track</h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                      Balancing high-school academics with full-stack programming tests. Ready to expand into university levels with solid computer engineering skills!
                    </p>
                  </div>
                  <img 
                    src="https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=350&q=80" 
                    className="w-full md:w-[240px] h-[130px] object-cover rounded-2xl border border-white/10" 
                    alt="Academics" 
                  />
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* FULL-SCREEN LIGHTBOX OVERLAY */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[90] flex flex-col items-center justify-center p-4"
          >
            <button 
              onClick={() => setLightboxUrl(null)} 
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition bg-white/5 p-3 rounded-full hover:bg-white/10 border border-white/5 cursor-pointer"
              title="Close Full Lightbox"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="max-w-5xl w-full max-h-[80vh] flex items-center justify-center p-2 relative">
              <motion.img 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                src={lightboxUrl} 
                className="max-w-full max-h-[75vh] object-contain rounded-xl border border-white/10 shadow-2xl" 
                alt="Selected asset" 
              />
            </div>

            <div className="mt-4 flex flex-col items-center text-center gap-3 max-w-lg w-full">
              <p className="text-xs text-slate-300 font-mono bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                {lightboxTitle}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => copyPublicUrl(lightboxUrl)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition bg-cyan-950/40 px-3.5 py-2 rounded-lg border border-cyan-800/50 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Secure URL
                </button>
                <a 
                  target="_blank" 
                  rel="noreferrer"
                  href={lightboxUrl} 
                  className="flex items-center gap-1.5 text-xs text-slate-450 hover:text-white transition bg-white/5 px-3.5 py-2 rounded-lg border border-white/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Direct CDN
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECURE REGISTER / LOGIN OVERLAY MODAL */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="glass-panel p-6 sm:p-8 rounded-2xl w-full max-w-md border border-white/15 shadow-22xl relative text-left"
            >
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                title="Cancel login details"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-1 mb-6">
                <h3 className="text-xl font-display font-extrabold text-white">
                  {authMode === 'signin' ? 'Siyam Social Login' : 'Register Custom Account'}
                </h3>
                <p className="text-xs text-slate-400">
                  {authMode === 'signin' 
                    ? 'Authenticate yourself to React, edit and write feed entries.' 
                    : 'Create your sandbox identity in Siyam\'s live Cloud Database.'}
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded-lg mb-4 leading-normal">
                  {authError}
                </div>
              )}

              {/* Dev notice explaining how to configure console auth details */}
              <div className="p-2.5 bg-cyan-950/40 border border-cyan-900/40 text-[10px] text-cyan-400 rounded-lg mb-4 leading-tight">
                <strong>Console Setup Notice:</strong> If email auth actions fail, make sure <strong>Email/Password</strong> or <strong>Google Sign-In</strong> is toggled to ENABLE in Firebase Auth under Project ID: <code>nice-interface-wmvz5</code>.
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                
                {authMode === 'signup' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">Public Display Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full glass-input text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full glass-input text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg"
                      placeholder="siyamrahman1268@gmail.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">Credentials Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full glass-input text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-bold rounded-lg text-xs sm:text-sm hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
                >
                  {authLoading ? 'Verifying...' : authMode === 'signin' ? 'Login' : 'Signup'}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[10px] font-mono text-slate-500 uppercase">Or Continue with</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-white/10 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.253-3.133C18.41 1.253 15.54 0 12.24 0 5.58 0 .24 5.34.24 12s5.34 12 12 12c6.958 0 11.59-4.891 11.59-11.79 0-.796-.085-1.403-.19-1.925H12.24z"/>
                  </svg>
                  Google Sign-In
                </button>

              </form>

              <div className="mt-5 text-center text-xs text-slate-400">
                {authMode === 'signin' ? (
                  <span>
                    New to this app?{' '}
                    <button 
                      onClick={() => setAuthMode('signup')}
                      className="text-cyan-400 hover:underline cursor-pointer font-bold ml-1"
                    >
                      Register Custom Account
                    </button>
                  </span>
                ) : (
                  <span>
                    Already registered?{' '}
                    <button 
                      onClick={() => setAuthMode('signin')}
                      className="text-cyan-400 hover:underline cursor-pointer font-bold ml-1"
                    >
                      Log in to session
                    </button>
                  </span>
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="w-full bg-[#02050E] border-t border-white/5 py-6 font-mono text-[10px] sm:text-xs text-slate-500 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} Sahedur Rahman Siyam. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="text-cyan-455">Dhaka, Bangladesh</span>
            <span>&bull;</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-rose-400 font-bold uppercase tracking-wide">
              Security Matrix Lock: ON
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
