import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  query,
  getDocs,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Post, Comment, UserProfile } from '../types';
import { 
  Shield, 
  Users, 
  FileText, 
  MessageSquare, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  RefreshCcw, 
  Database, 
  Settings, 
  PlusCircle, 
  Activity, 
  Grid,
  History,
  Clock
} from 'lucide-react';

interface AdminConsoleProps {
  currentUser: any;
  isAdmin: boolean;
  triggerToast: (title: string, msg: string, type: 'success' | 'error' | 'info') => void;
  isSandboxMode: boolean;
}

export default function AdminConsole({ currentUser, isAdmin, triggerToast, isSandboxMode }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'comments' | 'diagnostics' | 'logs'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [postsList, setPostsList] = useState<Post[]>([]);
  const [commentsMap, setCommentsMap] = useState<{ [postId: string]: Comment[] }>({});
  const [loading, setLoading] = useState(true);

  // Audit activity log state tracking
  const [localLogs, setLocalLogs] = useState<any[]>([]);
  const [cloudLogsCache, setCloudLogsCache] = useState<any[]>([]);

  // Inline editting state for Admin overrides
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserBio, setEditingUserBio] = useState('');

  // Sandbox simulation triggers
  const [localUsers, setLocalUsers] = useState<UserProfile[]>([]);
  const [localPosts, setLocalPosts] = useState<Post[]>([]);

  // Load audit logs and register real-time logs listeners on mount
  useEffect(() => {
    // 1. Sandbox Logs Loading
    const storedSandbox = localStorage.getItem('siyam_sandbox_audit_logs');
    if (storedSandbox) {
      setLocalLogs(JSON.parse(storedSandbox));
    } else {
      const initialSandbox = [
        {
          id: 'log_sandbox_init',
          action: 'LOG_INIT',
          details: 'Initialized secure local state tracker. Offline testing bypass active.',
          performedBy: 'siyamrahman1268@gmail.com',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          mode: 'sandbox'
        }
      ];
      localStorage.setItem('siyam_sandbox_audit_logs', JSON.stringify(initialSandbox));
      setLocalLogs(initialSandbox);
    }

    // 2. Cloud Logs Cache
    const storedCloud = localStorage.getItem('siyam_cloud_audit_logs_cache');
    if (storedCloud) {
      setCloudLogsCache(JSON.parse(storedCloud));
    }

    if (!isSandboxMode) {
      try {
        const q = query(collection(db, 'audit_logs'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const cloudData: any[] = [];
          snapshot.forEach((doc) => {
            const d = doc.data();
            cloudData.push({
              id: doc.id,
              action: d.action || 'ACTION',
              details: d.details || '',
              performedBy: d.performedBy || 'Unknown Admin',
              timestamp: d.timestamp || new Date().toISOString(),
              mode: 'cloud'
            });
          });
          // Sort descending
          cloudData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setCloudLogsCache(cloudData);
          localStorage.setItem('siyam_cloud_audit_logs_cache', JSON.stringify(cloudData));
        }, (err) => {
          console.warn("Firestore audit_logs snapshot closed (Permission or rule restriction). Falling back to local cache storage.", err);
        });
        return () => unsubscribe();
      } catch (e) {
        console.warn("Firestore collection initializer failed:", e);
      }
    }
  }, [isSandboxMode]);

  // Helper action logger helper
  const addAuditLog = async (action: string, details: string) => {
    const adminEmail = currentUser?.email || 'siyamrahman1268@gmail.com';
    const newLog = {
      id: `log_${Date.now()}`,
      action,
      details,
      performedBy: adminEmail,
      timestamp: new Date().toISOString(),
      mode: isSandboxMode ? 'sandbox' : 'cloud'
    };

    if (isSandboxMode) {
      const stored = localStorage.getItem('siyam_sandbox_audit_logs');
      const list = stored ? JSON.parse(stored) : [];
      const updated = [newLog, ...list].slice(0, 100);
      localStorage.setItem('siyam_sandbox_audit_logs', JSON.stringify(updated));
      setLocalLogs(updated);
    } else {
      try {
        // Log to Firebase
        const logRef = doc(collection(db, 'audit_logs'));
        await setDoc(logRef, {
          id: logRef.id,
          action,
          details,
          performedBy: adminEmail,
          timestamp: new Date().toISOString()
        });
      } catch (e: any) {
        console.warn("Firestore logs write blocked (Missing collection/permissions rules matching):", e);
      }
      // Always store locally on machine to display instantly
      const storedCloud = localStorage.getItem('siyam_cloud_audit_logs_cache');
      const list = storedCloud ? JSON.parse(storedCloud) : [];
      const updated = [newLog, ...list].slice(0, 50);
      localStorage.setItem('siyam_cloud_audit_logs_cache', JSON.stringify(updated));
      setCloudLogsCache(updated);
    }
  };

  // Fetch registered user profiles
  useEffect(() => {
    if (isSandboxMode) {
      const storedUsers = localStorage.getItem('siyam_sandbox_users');
      if (storedUsers) {
        setLocalUsers(JSON.parse(storedUsers));
        setUsersList(JSON.parse(storedUsers));
      } else {
        const defaultUsers: UserProfile[] = [
          {
            uid: 'admin-siyam',
            email: 'siyamrahman1268@gmail.com',
            displayName: 'Sahedur Rahman Siyam (Admin)',
            photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=siyam',
            bio: 'Class 12 Student | Live DB Supreme Administrator',
            role: 'admin',
            createdAt: new Date().toISOString()
          },
          {
            uid: 'user-demo1',
            email: 'demouser1@gmail.com',
            displayName: 'Ahsanul Kabir',
            photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ahsan',
            bio: 'Avid Anime visualizer from Dhaka, Bangladesh.',
            role: 'user',
            createdAt: new Date().toISOString()
          }
        ];
        localStorage.setItem('siyam_sandbox_users', JSON.stringify(defaultUsers));
        setLocalUsers(defaultUsers);
        setUsersList(defaultUsers);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        usersData.push({
          uid: doc.id,
          email: d.email || '',
          displayName: d.displayName || 'Dev Partner',
          photoURL: d.photoURL || '',
          bio: d.bio || '',
          role: d.role || 'user',
          createdAt: d.createdAt || ''
        });
      });
      setUsersList(usersData);
      setLoading(false);
    }, (error) => {
      console.warn("Real-time profiles fetching disabled by permissions rules. Fetching current user only.", error);
      // Fallback: If permissions prevent general reading of other profiles, let's pre-populate with the active user details
      if (currentUser) {
        setUsersList([{
          uid: currentUser.uid,
          email: currentUser.email || 'developer@gmail.com',
          displayName: currentUser.displayName || 'Developer',
          photoURL: currentUser.photoURL || '',
          role: 'admin',
          createdAt: new Date().toISOString()
        }]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSandboxMode, currentUser]);

  // Fetch posts and load related comment threads
  useEffect(() => {
    if (isSandboxMode) {
      const storedPosts = localStorage.getItem('siyam_sandbox_posts');
      if (storedPosts) {
        const parsed = JSON.parse(storedPosts);
        setLocalPosts(parsed);
        setPostsList(parsed);
      } else {
        const defaultPosts: Post[] = [
          {
            id: 'post-1',
            content: 'Just successfully deployed the Zero-Trust Firebase security architecture on Sahedur\'s Social Space. Let\'s make sure to test out comment filtering and edit user options!',
            category: 'Coding',
            authorId: 'admin-siyam',
            authorName: 'Sahedur Rahman Siyam',
            authorEmail: 'siyamrahman1268@gmail.com',
            authorAvatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=siyam',
            createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 },
            lovesCount: 5,
            lovedBy: ['user-demo1']
          },
          {
            id: 'post-2',
            content: 'Which Korean drama is currently a must-watch? Let me know in Siyam\'s comments stream below #Anime #Series',
            category: 'Anime',
            authorId: 'user-demo1',
            authorName: 'Ahsanul Kabir',
            authorEmail: 'demouser1@gmail.com',
            authorAvatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ahsan',
            createdAt: { seconds: Math.floor(Date.now() / 1000) - 1800 },
            lovesCount: 2,
            lovedBy: ['admin-siyam']
          }
        ];
        localStorage.setItem('siyam_sandbox_posts', JSON.stringify(defaultPosts));
        setLocalPosts(defaultPosts);
        setPostsList(defaultPosts);
      }
      return;
    }

    const q = query(collection(db, 'posts'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const postsData: Post[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        postsData.push({
          id: doc.id,
          content: d.content || '',
          imageUrl: d.imageUrl,
          category: d.category || 'Coding',
          authorId: d.authorId || '',
          authorName: d.authorName || '',
          authorEmail: d.authorEmail || '',
          authorAvatar: d.authorAvatar || '',
          createdAt: d.createdAt,
          lovesCount: d.lovesCount || 0,
          lovedBy: d.lovedBy || []
        });
      });
      setPostsList(postsData);

      // Dynamically subscribe to comments under each retrieved post
      postsData.forEach((pst) => {
        const commRef = collection(db, 'posts', pst.id, 'comments');
        getDocs(commRef).then((commSnap) => {
          const commArray: Comment[] = [];
          commSnap.forEach((cDoc) => {
            const cd = cDoc.data();
            commArray.push({
              id: cDoc.id,
              postId: pst.id,
              content: cd.content || '',
              authorId: cd.authorId || '',
              authorName: cd.authorName || '',
              authorEmail: cd.authorEmail || '',
              authorAvatar: cd.authorAvatar || '',
              createdAt: cd.createdAt
            });
          });
          setCommentsMap(prev => ({ ...prev, [pst.id]: commArray }));
        }).catch(err => console.warn(`Couldn't load comments under post ${pst.id}`, err));
      });

    }, (err) => {
      console.warn("Unable to stream admin posts:", err);
    });

    return () => unsubscribe();
  }, [isSandboxMode]);

  // Handle bootstrap mock db action
  const handleBootstrapMockData = () => {
    if (isSandboxMode) {
      const mockUsers: UserProfile[] = [
        {
          uid: 'admin-siyam',
          email: 'siyamrahman1268@gmail.com',
          displayName: 'Sahedur Rahman Siyam',
          photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=siyam',
          bio: 'Class 12 Student | Dhaka Dev Admin',
          role: 'admin',
          createdAt: new Date().toISOString()
        },
        {
          uid: 'user-2',
          email: 'tanzim091@gmail.com',
          displayName: 'Tanzim Elahi',
          photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=tanzim',
          bio: 'Class 12 Science division student in Notre Dame College Dhaka!',
          role: 'user',
          createdAt: new Date().toISOString()
        },
        {
          uid: 'user-3',
          email: 'nayemrahman2@gmail.com',
          displayName: 'Nayemur Rahman',
          photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=nayem',
          role: 'user',
          createdAt: new Date().toISOString()
        }
      ];

      const mockPosts: Post[] = [
        {
          id: 'post-mock-01',
          content: 'Excited about the Class 12 final model exams starting next week! Living in Dhaka studying chemistry logic and web systems parallel.',
          category: 'Coding',
          authorId: 'admin-siyam',
          authorName: 'Sahedur Rahman Siyam',
          authorEmail: 'siyamrahman1268@gmail.com',
          authorAvatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=siyam',
          createdAt: { seconds: Math.floor(Date.now() / 1000) - 7200 },
          lovesCount: 3,
          lovedBy: ['user-2', 'user-3']
        },
        {
          id: 'post-mock-02',
          content: 'Just finished watching Your Name (Kimi no Na wa) for the fifth time. Shinkai Shinkai is a pure legend! Anime landscapes are literally flawless.',
          category: 'Anime',
          authorId: 'user-2',
          authorName: 'Tanzim Elahi',
          authorEmail: 'tanzim091@gmail.com',
          authorAvatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=tanzim',
          createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 },
          lovesCount: 1,
          lovedBy: ['admin-siyam']
        }
      ];

      localStorage.setItem('siyam_sandbox_users', JSON.stringify(mockUsers));
      localStorage.setItem('siyam_sandbox_posts', JSON.stringify(mockPosts));
      setUsersList(mockUsers);
      setPostsList(mockPosts);

      addAuditLog('BOOTSTRAP', 'Bootstrapped Sandbox database schemas with default mock users and posts stream');
      triggerToast("Sandbox Boostrapped", "Demo databases pre-populated with default student records successfully!", "success");
    } else {
      triggerToast("Bootstrap Blocked", "Bootstrapping default profiles can only be tested under Demo Sandbox Mode to prevent polluting the live database production files", "info");
    }
  };

  // Delete User database Profile
  const handleDeleteUser = async (profileId: string) => {
    if (profileId === 'admin-siyam' || (currentUser && profileId === currentUser.uid)) {
      triggerToast("Operation Blocked", "Supreme Owner profile protection act active. You cannot delete the active administrator account.", "error");
      return;
    }
    if (!window.confirm("Are you absolutely sure you want to completely erase this user's profile documents? This is irreversible.")) return;

    if (isSandboxMode) {
      const nextUsers = usersList.filter(u => u.uid !== profileId);
      localStorage.setItem('siyam_sandbox_users', JSON.stringify(nextUsers));
      setUsersList(nextUsers);
      addAuditLog('DELETE_USER', `Erazed mock user profile ID: ${profileId} from Sandbox db`);
      triggerToast("Mock Erased", "User profile details deleted from mock sandbox storage.", "success");
    } else {
      try {
        await deleteDoc(doc(db, 'users', profileId));
        addAuditLog('DELETE_USER', `Permanently deleted user profile ID: ${profileId} from Live Firestore`);
        triggerToast("Profile Erased", "Document removed from the cloud database securely.", "success");
      } catch (err: any) {
        triggerToast("Delete Failed", err?.message || 'Access denied', "error");
      }
    }
  };

  // Update profile details directly
  const handleStartEditingUser = (user: UserProfile) => {
    setEditingUserId(user.uid);
    setEditingUserName(user.displayName);
    setEditingUserBio(user.bio || '');
  };

  const handleSaveUserEdit = async (userId: string) => {
    if (!editingUserName.trim()) {
      triggerToast("Validation error", "Display name cannot be empty.", "error");
      return;
    }

    if (isSandboxMode) {
      const nextUsers = usersList.map(u => u.uid === userId ? { ...u, displayName: editingUserName, bio: editingUserBio } : u);
      localStorage.setItem('siyam_sandbox_users', JSON.stringify(nextUsers));
      setUsersList(nextUsers);
      setEditingUserId(null);
      addAuditLog('UPDATE_USER', `Updated mock user profile UID: ${userId} to name: "${editingUserName}"`);
      triggerToast("Mock Saved", "Profile updated inside sandbox memory storage.", "success");
    } else {
      try {
        await updateDoc(doc(db, 'users', userId), {
          displayName: editingUserName,
          bio: editingUserBio
        });
        setEditingUserId(null);
        addAuditLog('UPDATE_USER', `Updated Live Firestore user profile UID: ${userId} to name: "${editingUserName}"`);
        triggerToast("Profile Saved", "Firestore record updated recursively.", "success");
      } catch (err: any) {
        triggerToast("Save Failed", err?.message || 'Transaction aborted', "error");
      }
    }
  };

  // Delete Post directly
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Remove this post permanently from Siyam's Feed?")) return;

    if (isSandboxMode) {
      const nextPosts = postsList.filter(p => p.id !== postId);
      localStorage.setItem('siyam_sandbox_posts', JSON.stringify(nextPosts));
      setPostsList(nextPosts);
      addAuditLog('DELETE_POST', `Deleted mock post ID: ${postId} from Sandbox db`);
      triggerToast("Post Mock Erased", "Deleted post from local memory.", "success");
    } else {
      try {
        await deleteDoc(doc(db, 'posts', postId));
        addAuditLog('DELETE_POST', `Permanently deleted Live Firestore post ID: ${postId}`);
        triggerToast("Post Deleted", "Firestore post document wiped out.", "success");
      } catch (err: any) {
        triggerToast("Action Denied", err?.message || 'Security override trigger', "error");
      }
    }
  };

  // Save Post update inline
  const handleSavePostEdit = async (postId: string) => {
    if (!editingPostContent.trim()) {
      triggerToast("Empty post", "Content text required.", "error");
      return;
    }

    if (isSandboxMode) {
      const nextPosts = postsList.map(p => p.id === postId ? { ...p, content: editingPostContent } : p);
      localStorage.setItem('siyam_sandbox_posts', JSON.stringify(nextPosts));
      setPostsList(nextPosts);
      setEditingPostId(null);
      addAuditLog('UPDATE_POST', `Modified status description content for mock post ID: ${postId}`);
      triggerToast("Mock Updated", "Inline content post details saved.", "success");
    } else {
      try {
        await updateDoc(doc(db, 'posts', postId), {
          content: editingPostContent
        });
        setEditingPostId(null);
        addAuditLog('UPDATE_POST', `Updated status description content for Live Firestore post ID: ${postId}`);
        triggerToast("Success", "Post updated live on server.", "success");
      } catch (err: any) {
        triggerToast("Error", err?.message || 'Access denied', "error");
      }
    }
  };

  // Delete individual comment instantly
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;

    if (isSandboxMode) {
      // Offline comments trigger
      addAuditLog('DELETE_COMMENT', `Removed mock comment ID ${commentId} from Sandbox environment`);
      triggerToast("Demo comment removal", "Comment removed from demonstration viewport.", "success");
    } else {
      try {
        await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
        addAuditLog('DELETE_COMMENT', `Permanently deleted Live comment ID ${commentId} from Firestore`);
        triggerToast("Deleted", "Comment wiped from subcollection.", "success");
        // Update local map state
        setCommentsMap(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
        }));
      } catch (err: any) {
        triggerToast("Permission Denied", "Error managing comment sub-records.", "error");
      }
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 text-left space-y-8 min-h-[70vh]">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-500 font-mono">
            <Shield className="w-3.5 h-3.5" />
            <span>Authenticated Database Manager</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">Siyam Supreme Administrative Panel</h2>
          <p className="text-xs text-slate-400">
            Secure administrative matrix. Only Siyam's email has permission to look up user tables, moderate content, delete posts and prune comments.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={handleBootstrapMockData}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-xs border border-indigo-800/40 rounded-lg font-mono transition cursor-pointer"
            title="Bootstrap fake rows when testing offline"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Bootstrap Demo DB</span>
          </button>

          <div className="px-3.5 py-1.5 bg-[#050917] border border-white/5 rounded-lg text-xs flex items-center gap-2 text-slate-300 font-mono">
            <span className={`w-2 h-2 rounded-full ${isSandboxMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span>Mode: {isSandboxMode ? 'Sandbox Simulator' : 'Live Cloud Firebase'}</span>
          </div>
        </div>
      </div>

      {/* QUICK STATUS BENCH */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#050812] border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-widest block">Total Profiles</span>
            <span className="text-2xl font-bold text-white font-display mt-1 block">{usersList.length}</span>
          </div>
          <Users className="w-8 h-8 text-cyan-500/30" />
        </div>

        <div className="bg-[#050812] border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-widest block">Core Feed Items</span>
            <span className="text-2xl font-bold text-white font-display mt-1 block">{postsList.length}</span>
          </div>
          <FileText className="w-8 h-8 text-rose-500/30" />
        </div>

        <div className="bg-[#050812] border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-widest block">Cloud Comments</span>
            <span className="text-2xl font-bold text-white font-display mt-1 block">
              {isSandboxMode ? 'Persistent' : Object.values(commentsMap).reduce((acc: number, curr) => acc + (curr as any[]).length, 0)}
            </span>
          </div>
          <MessageSquare className="w-8 h-8 text-emerald-500/30" />
        </div>

        <div className="bg-[#050812] border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-widest block">Admin Privileges</span>
            <span className="text-[11px] text-yellow-400 font-mono px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full mt-2 inline-block">
              ACTIVE
            </span>
          </div>
          <Shield className="w-8 h-8 text-yellow-500/20" />
        </div>
      </div>

      {/* TABS CONTROLLERS */}
      <div className="flex border-b border-white/5 gap-1 select-none overflow-x-auto pb-1 font-mono text-xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4.5 py-2.5 rounded-t-xl transition cursor-pointer flex items-center gap-2 font-bold ${activeTab === 'users' ? 'bg-[#050812] border border-white/10 border-b-transparent text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Users className="w-4 h-4" />
          <span>User Profiles Table ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4.5 py-2.5 rounded-t-xl transition cursor-pointer flex items-center gap-2 font-bold ${activeTab === 'posts' ? 'bg-[#050812] border border-white/10 border-b-transparent text-rose-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <FileText className="w-4 h-4" />
          <span>Feed Posts Stream ({postsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`px-4.5 py-2.5 rounded-t-xl transition cursor-pointer flex items-center gap-2 font-bold ${activeTab === 'comments' ? 'bg-[#050812] border border-white/10 border-b-transparent text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Comment Threads</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4.5 py-2.5 rounded-t-xl transition cursor-pointer flex items-center gap-2 font-bold ${activeTab === 'diagnostics' ? 'bg-[#050812] border border-white/10 border-b-transparent text-yellow-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Activity className="w-4 h-4" />
          <span>Matrix Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4.5 py-2.5 rounded-t-xl transition cursor-pointer flex items-center gap-2 font-bold ${activeTab === 'logs' ? 'bg-[#050812] border border-white/10 border-b-transparent text-amber-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <History className="w-4 h-4" />
          <span>Audit Logs ({isSandboxMode ? localLogs.length : cloudLogsCache.length})</span>
        </button>
      </div>

      {/* CORE CONTENT RENDERERS */}
      <div className="min-h-[40vh] bg-[#050812]/50 border border-white/5 rounded-2xl p-4 sm:p-6 overflow-hidden">
        
        {loading ? (
          <div className="py-20 text-center font-mono text-xs text-slate-400 space-y-2">
            <RefreshCcw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
            <p>Syncing authenticated database structures...</p>
          </div>
        ) : (
          <>
            {/* USERS ADMIN PAGE */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left font-sans text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-950/85 font-mono text-[10px] tracking-wider uppercase text-slate-400 border-b border-white/10 text-left">
                        <th className="p-3.5 pl-4">Account ID / Avatar</th>
                        <th className="p-3.5">Display Name</th>
                        <th className="p-3.5">Email / Status</th>
                        <th className="p-3.5">Registered Bio</th>
                        <th className="p-3.5 text-right pr-4">Database Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {usersList.length > 0 ? (
                        usersList.map((user) => (
                          <tr key={user.uid} className="hover:bg-white/[0.01] transition-colors leading-relaxed">
                            <td className="p-3 text-left">
                              <div className="flex items-center gap-3">
                                <img src={user.photoURL} className="w-9 h-9 rounded-full object-cover border border-white/10 bg-slate-950" alt="avatar" />
                                <div className="font-mono text-[9px] text-slate-500">
                                  <span className="text-cyan-400 block">{user.role.toUpperCase()}</span>
                                  <span className="block truncate max-w-[80px]">{user.uid}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-slate-200">
                              {editingUserId === user.uid ? (
                                <input
                                  type="text"
                                  value={editingUserName}
                                  onChange={(e) => setEditingUserName(e.target.value)}
                                  className="px-2 py-1 bg-slate-900 border border-white/15 text-white rounded text-xs focus:outline-none focus:border-cyan-500"
                                />
                              ) : (
                                <span>{user.displayName}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-mono block text-slate-300">{user.email}</span>
                              <span className="text-[10px] text-slate-500">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400">
                              {editingUserId === user.uid ? (
                                <textarea
                                  value={editingUserBio}
                                  onChange={(e) => setEditingUserBio(e.target.value)}
                                  className="w-full p-2 bg-slate-900 border border-white/15 text-white rounded text-xs focus:outline-none focus:border-cyan-500"
                                  rows={2}
                                />
                              ) : (
                                <p className="line-clamp-2 text-xs italic">{user.bio || '— Status empty —'}</p>
                              )}
                            </td>
                            <td className="p-3 text-right pr-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {editingUserId === user.uid ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveUserEdit(user.uid)}
                                      className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 rounded transition cursor-pointer"
                                      title="Save custom bio alterations"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingUserId(null)}
                                      className="p-1.5 bg-slate-900 text-slate-400 border border-white/10 rounded transition cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleStartEditingUser(user)}
                                      className="p-1.5 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/40 rounded transition cursor-pointer"
                                      title="Moderate registered profile info"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.uid)}
                                      className="p-1.5 bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800/40 rounded transition cursor-pointer"
                                      title="Wipe account references"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                            No account profiles mapped inside the user schema yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* POSTS ADMIN PAGE */}
            {activeTab === 'posts' && (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left font-sans text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/85 font-mono text-[10px] tracking-wider uppercase text-slate-400 border-b border-b-white/10">
                        <th className="p-3.5 pl-4">Author Info</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5">Post Content Body</th>
                        <th className="p-3.5">Image URL Attachment</th>
                        <th className="p-3.5 text-center">Loves</th>
                        <th className="p-3.5 text-right pr-4">Administration Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {postsList.length > 0 ? (
                        postsList.map((post) => (
                          <tr key={post.id} className="hover:bg-white/[0.01] transition-colors">
                            <td className="p-3.5 pl-4">
                              <div className="flex items-center gap-2.5">
                                <img src={post.authorAvatar} className="w-8 h-8 rounded-full border border-white/5 object-cover" alt="Author" />
                                <div>
                                  <span className="block font-bold text-slate-200">{post.authorName}</span>
                                  <span className="block text-[10px] font-mono text-slate-500 max-w-[120px] truncate">{post.authorEmail}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 select-none">
                              <span className="font-mono text-[10px] bg-cyan-950/50 text-cyan-400 px-2.5 py-1 border border-cyan-800/40 rounded-full">
                                #{post.category}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-300 max-w-sm">
                              {editingPostId === post.id ? (
                                <textarea
                                  value={editingPostContent}
                                  onChange={(e) => setEditingPostContent(e.target.value)}
                                  className="w-full p-2 bg-slate-900 border border-white/15 text-white rounded text-xs focus:outline-none focus:border-cyan-500"
                                  rows={3}
                                />
                              ) : (
                                <p className="line-clamp-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-500 font-mono text-[10px]">
                              {post.imageUrl ? (
                                <a href={post.imageUrl} target="_blank" rel="noreferrer" className="text-rose-450 hover:underline hover:text-rose-300 transition block truncate max-w-[150px]">
                                  {post.imageUrl}
                                </a>
                              ) : (
                                <span className="text-slate-600 block italic">No media attach</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center font-bold text-slate-100 font-display">
                              {post.lovesCount}
                            </td>
                            <td className="p-3.5 text-right pr-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {editingPostId === post.id ? (
                                  <>
                                    <button
                                      onClick={() => handleSavePostEdit(post.id)}
                                      className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 rounded transition cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingPostId(null)}
                                      className="p-1.5 bg-slate-900 text-slate-400 border border-white/10 rounded transition"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingPostId(post.id);
                                        setEditingPostContent(post.content);
                                      }}
                                      className="p-1.5 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/40 rounded transition cursor-pointer"
                                      title="Moderate post text inline"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePost(post.id)}
                                      className="p-1.5 bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800/40 rounded transition cursor-pointer"
                                      title="Delete post and related sub-comments"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                            The cloud stream has zero published statuses.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* COMMENTS ADMIN PAGE */}
            {activeTab === 'comments' && (
              <div className="space-y-6">
                <div className="text-[11px] text-slate-400 font-mono bg-white/[0.02] p-3 border border-white/5 rounded-xl">
                  Select a post to manage its comments thread dynamically. Deleting posts will automatically delete the child comment node records.
                </div>

                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-1">
                  {postsList.map((post) => {
                    const postComments = commentsMap[post.id] || [];
                    return (
                      <div key={post.id} className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-[11px] font-mono font-bold text-slate-400">
                            Post by <span className="text-cyan-400">{post.authorName}</span> &bull; "{post.content.slice(0, 50)}..."
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase font-medium">
                            {postComments.length} active responses
                          </span>
                        </div>

                        {postComments.length > 0 ? (
                          <div className="space-y-2">
                            {postComments.map((comm) => (
                              <div key={comm.id} className="flex gap-3 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-lg p-2.5 relative group justify-between items-start">
                                <div className="flex gap-2.5 items-start">
                                  <img src={comm.authorAvatar} className="w-7 h-7 rounded-full object-cover border border-white/5" alt="Commenter" />
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-200">{comm.authorName}</span>
                                      <span className="text-[9px] font-mono text-slate-500">[{comm.authorEmail}]</span>
                                    </div>
                                    <p className="text-xs text-slate-350 leading-relaxed font-sans">{comm.content}</p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleDeleteComment(post.id, comm.id)}
                                  className="p-1 hover:bg-red-950/40 text-rose-500 rounded border border-transparent hover:border-red-900/40 cursor-pointer"
                                  title="Delete specific comment instantly"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600 font-mono italic pad-left pl-2">No comments have been posted to this timeline.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DIAGNOSTICS PAGE */}
            {activeTab === 'diagnostics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs text-left">
                <div className="bg-slate-950/60 p-5 rounded-xl border border-white/5 space-y-3">
                  <h4 className="font-bold text-yellow-500 uppercase font-mono border-b border-white/5 pb-2 flex items-center gap-1.5 leading-none">
                    <Database className="w-4 h-4" /> System Connection Details
                  </h4>
                  <div className="space-y-1.5 leading-relaxed">
                    <p><span className="text-slate-500">Firestore Instance ID:</span> <span className="text-yellow-405 text-amber-400">nice-interface-wmvz5</span></p>
                    <p><span className="text-slate-500">Region Target:</span> <span className="text-slate-300">asia-east1</span></p>
                    <p><span className="text-slate-500">Access Policy:</span> <span className="text-slate-300">Hardened ABAC rules v2</span></p>
                    <p><span className="text-slate-500">Admin email:</span> <span className="text-cyan-400 font-bold">siyamrahman1268@gmail.com</span></p>
                    <p><span className="text-slate-500">ImgBB Storage API:</span> <span className="text-slate-300">Active CDN Proxy</span></p>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-5 rounded-xl border border-white/5 space-y-3">
                  <h4 className="font-bold text-yellow-500 uppercase font-mono border-b border-white/5 pb-2 flex items-center gap-1.5 leading-none">
                    <Settings className="w-4 h-4" /> Quick Matrix Actions
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Operations will run directly against targeted schema models. Deployments are synchronal to Firebase Console rules.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (isSandboxMode) {
                          localStorage.removeItem('siyam_sandbox_users');
                          localStorage.removeItem('siyam_sandbox_posts');
                          localStorage.removeItem('siyam_sandbox_audit_logs');
                          setUsersList([]);
                          setPostsList([]);
                          setLocalLogs([]);
                          triggerToast("Sandbox Purged", "Demo state and activity records cleared from browser cache.", "info");
                        } else {
                          triggerToast("Action Blocked", "Live Firestore sweeps can only be performed by direct command script tools or the Firebase console", "error");
                        }
                      }}
                      className="px-3.5 py-2 hover:bg-red-950/30 text-rose-455 hover:text-red-400 text-[10px] font-bold border border-red-950 hover:border-red-800 rounded-lg cursor-pointer transition uppercase"
                    >
                      Purge Sandbox Tables
                    </button>
                    
                    <button
                      onClick={() => {
                        triggerToast("Diagnostic Passed", "All database collection schema structures match firebase-blueprint specifications perfectly.", "success");
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 rounded-lg cursor-pointer text-[10px] transition uppercase"
                    >
                      Verify Document Integrity
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT LOGS PAGE */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-500 font-mono tracking-wide uppercase flex items-center gap-1.5 leading-none">
                      <History className="w-4 h-4" /> SECURE AUDIT TRAIL LOGS
                    </h3>
                    <p className="text-xs text-slate-400 font-sans leading-normal">
                      Security events, index deletions, and metadata records executed by authenticated operators.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => {
                        if (isSandboxMode) {
                          localStorage.removeItem('siyam_sandbox_audit_logs');
                          setLocalLogs([]);
                          triggerToast("Sandbox Logs Reseted", "Emptied offline sandbox audit logs trace.", "info");
                        } else {
                          localStorage.removeItem('siyam_cloud_audit_logs_cache');
                          setCloudLogsCache([]);
                          triggerToast("Logs Cache Emptied", "Cleaned local viewports cache.", "info");
                        }
                      }}
                      className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-500/50 text-red-400 font-mono text-[10px] uppercase font-bold rounded-lg cursor-pointer transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear Local Timeline
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="bg-slate-950/30 p-4 rounded-xl border border-white/5 space-y-1">
                    <span className="text-slate-500 block uppercase text-[10px] tracking-wider font-semibold">Environment Mode</span>
                    <span className={`text-[13px] font-bold ${isSandboxMode ? 'text-amber-400' : 'text-cyan-400'}`}>
                      {isSandboxMode ? '🔒 Sandbox Test Database' : '⚡ Live Cloud Production'}
                    </span>
                  </div>
                  <div className="bg-slate-950/30 p-4 rounded-xl border border-white/5 space-y-1">
                    <span className="text-slate-500 block uppercase text-[10px] tracking-wider font-semibold">Active Auth Operator</span>
                    <span className="text-[13px] text-slate-300 font-bold block truncate">
                      {currentUser?.email || 'siyamrahman1268@gmail.com'}
                    </span>
                  </div>
                  <div className="bg-slate-950/30 p-4 rounded-xl border border-white/5 space-y-1">
                    <span className="text-slate-500 block uppercase text-[10px] tracking-wider font-semibold">Active Event Stream</span>
                    <span className="text-[13px] text-emerald-400 font-bold font-mono">
                      {isSandboxMode ? localLogs.length : cloudLogsCache.length} Operations Indexed
                    </span>
                  </div>
                </div>

                {/* Audit table/list of logs */}
                <div className="space-y-3.5 pb-2">
                  {((isSandboxMode ? localLogs : cloudLogsCache).length === 0) ? (
                    <div className="py-12 text-center rounded-2xl bg-[#030610] border border-white/5 font-mono text-xs text-slate-500 space-y-2">
                      <Clock className="w-7 h-7 mx-auto text-slate-600 animate-pulse" />
                      <p>No administrative activities have been logged yet or timeline is empty.</p>
                      <p className="text-[10px] text-slate-600">Operations performed in this console session are captured in high-fidelity sandbox.</p>
                    </div>
                  ) : (
                    (isSandboxMode ? localLogs : cloudLogsCache).map((item: any, idx: number) => {
                      const act = item.action || '';
                      let badgeColor = "text-cyan-400 bg-cyan-950/20 border-cyan-500/20";
                      let actionIcon = <Activity className="w-4 h-4" />;

                      if (act.includes('DELETE_POST')) {
                        badgeColor = "text-rose-450 text-red-400 bg-red-950/20 border-red-500/20";
                        actionIcon = <Trash2 className="w-4 h-4" />;
                      } else if (act.includes('DELETE_USER')) {
                        badgeColor = "text-orange-400 bg-orange-950/20 border-orange-500/20";
                        actionIcon = <Users className="w-4 h-4" />;
                      } else if (act.includes('UPDATE_USER') || act.includes('UPDATE_POST')) {
                        badgeColor = "text-amber-400 bg-amber-950/20 border-amber-500/20";
                        actionIcon = <Edit className="w-4 h-4" />;
                      } else if (act.includes('BOOTSTRAP') || act.includes('LOG_INIT')) {
                        badgeColor = "text-emerald-400 bg-emerald-900/20 border-emerald-500/20";
                        actionIcon = <Shield className="w-4 h-4" />;
                      }

                      return (
                        <div 
                          key={item.id || idx} 
                          className="flex items-start gap-4 p-4 rounded-xl bg-[#030610] border border-white/5 hover:border-white/10 transition leading-normal text-left sm:items-center animate-fade-in"
                        >
                          <div className={`p-2 rounded-lg border flex-shrink-0 ${badgeColor}`}>
                            {actionIcon}
                          </div>
                          
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <span className={`font-mono text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border inline-block w-fit ${badgeColor}`}>
                                {item.action}
                              </span>
                              <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                <span>&middot;</span>
                                <span>{new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            </div>
                            
                            <p className="text-xs text-slate-200 font-sans font-light leading-relaxed">
                              {item.details}
                            </p>
                            
                            <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                              <span className="text-slate-600">PERFORMED BY:</span>
                              <span className="text-slate-300 font-semibold">{item.performedBy}</span>
                              {item.performedBy === 'siyamrahman1268@gmail.com' && (
                                <span className="text-cyan-400 border border-cyan-500/10 px-1 rounded text-[8px] uppercase tracking-widest font-bold">SUPREME ADMIN</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
