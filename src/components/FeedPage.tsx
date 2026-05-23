import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Post, Comment } from '../types';
import { 
  Heart, 
  MessageSquare, 
  Trash2, 
  Edit, 
  Send, 
  Image as ImageIcon, 
  X, 
  CheckCircle, 
  ShieldAlert, 
  FolderSync, 
  Maximize2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedPageProps {
  isAdmin: boolean;
  currentUser: any;
  onViewImage: (url: string, title: string) => void;
  triggerToast: (title: string, msg: string, type: 'success' | 'error' | 'info') => void;
  isSandboxMode?: boolean;
}

const MOCK_SANDBOX_POSTS: Post[] = [
  {
    id: 'mock_post_1',
    content: "Just finished watching a gorgeous anime movie by Makoto Shinkai! The lighting, cloud rendering, and musical tracks are absolutely spectacular. Highly recommend binge-watching this on a cozy night in Dhaka. 🌸✨",
    category: 'Anime',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=700&q=80',
    authorId: 'admin_uid',
    authorName: 'Sahedur Rahman Siyam',
    authorEmail: 'siyamrahman1268@gmail.com',
    authorAvatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Siyam',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), 
    lovesCount: 12,
    lovedBy: ['mock_user_2']
  },
  {
    id: 'mock_post_2',
    content: "Fascinating work setting up an offline mock testing Sandbox Engine to bypass Firebase Authentication Error (auth/operation-not-allowed)! When you toggle Sandbox Mode on, all database operations utilize custom local state trees and secure localStorage vectors perfectly. Modern full-stack architecture is amazing! ⚙️💻",
    category: 'Coding',
    authorId: 'admin_uid',
    authorName: 'Sahedur Rahman Siyam',
    authorEmail: 'siyamrahman1268@gmail.com',
    authorAvatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Siyam',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), 
    lovesCount: 24,
    lovedBy: ['mock_user_1']
  },
  {
    id: 'mock_post_3',
    content: "Exploring some beautiful quiet streets around Dhaka while listening to high-fidelity lo-fi loops. Class 12 exams are approaching soon, but taking a coding break under the glowing streetlamps is peaceful. 🌙🌃",
    category: 'Dhaka',
    imageUrl: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&w=700&q=80',
    authorId: 'admin_uid',
    authorName: 'Sahedur Rahman Siyam',
    authorEmail: 'siyamrahman1268@gmail.com',
    authorAvatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Siyam',
    createdAt: new Date(Date.now() - 1800000).toISOString(), 
    lovesCount: 8,
    lovedBy: []
  }
];

export default function FeedPage({ isAdmin, currentUser, onViewImage, triggerToast, isSandboxMode }: FeedPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [postContent, setPostContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Anime' | 'Coding' | 'Dhaka'>('Coding');
  const [activeTabFilter, setActiveTabFilter] = useState<'All' | 'Anime' | 'Coding' | 'Dhaka'>('All');
  
  // Imgbb image selection state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState(() => localStorage.getItem('siyam_imgbb_key') || '');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit states
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retrieve posts in real-time
  useEffect(() => {
    if (isSandboxMode) {
      const initSandboxPosts = () => {
        const stored = localStorage.getItem('siyam_sandbox_posts');
        if (stored) {
          setPosts(JSON.parse(stored));
        } else {
          localStorage.setItem('siyam_sandbox_posts', JSON.stringify(MOCK_SANDBOX_POSTS));
          setPosts(MOCK_SANDBOX_POSTS);
        }
      };
      
      initSandboxPosts();
      
      const handleStorageChange = () => {
        const stored = localStorage.getItem('siyam_sandbox_posts');
        if (stored) setPosts(JSON.parse(stored));
      };
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('siyam_sandbox_posts_update', handleStorageChange);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('siyam_sandbox_posts_update', handleStorageChange);
      };
    } else {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const postsData: Post[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          postsData.push({
            id: doc.id,
            content: d.content || '',
            imageUrl: d.imageUrl,
            category: d.category || 'All',
            authorId: d.authorId || '',
            authorName: d.authorName || '',
            authorEmail: d.authorEmail || '',
            authorAvatar: d.authorAvatar || '',
            createdAt: d.createdAt,
            lovesCount: d.lovesCount || 0,
            lovedBy: d.lovedBy || []
          });
        });
        setPosts(postsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      });

      return () => unsubscribe();
    }
  }, [currentUser, isSandboxMode]);

  // Handle selected image file
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        triggerToast('File Rejected', 'Image exceeds our 8MB buffer limit. Please select a smaller graphic.', 'error');
        return;
      }
      setAttachedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const cancelAttachment = () => {
    setAttachedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload to ImgBB helper
  const uploadImgbb = async (file: File): Promise<string> => {
    const apiKey = customKey.trim() || 'd2ff06df719b10997aa7f11538097a16';
    setUploadPercent(15);
    const formData = new FormData();
    formData.append('image', file);
    
    setUploadPercent(45);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });
    
    setUploadPercent(85);
    if (!response.ok) {
      throw new Error('Failed to upload image. Please verify your ImgBB key if you customized it.');
    }
    const result = await response.json();
    setUploadPercent(100);
    return result.data.url;
  };

  // Create post pipeline
  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      triggerToast('Auth Required', 'Please register or sign in to publish feeds.', 'error');
      return;
    }
    if (!postContent.trim() && !attachedFile) {
      triggerToast('Empty Post', 'Please write some text or attach an image.', 'info');
      return;
    }

    setIsSubmitting(true);
    let uploadedUrl = '';

    try {
      if (attachedFile) {
        uploadedUrl = await uploadImgbb(attachedFile);
      }

      if (isSandboxMode) {
        const newPost: Post = {
          id: `sandbox_${Date.now()}`,
          content: postContent,
          category: selectedCategory,
          authorId: currentUser.uid,
          authorName: currentUser.displayName || 'Anonymous Developer',
          authorEmail: currentUser.email || '',
          authorAvatar: currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.email || 'Siyam'}`,
          createdAt: new Date().toISOString(),
          lovesCount: 0,
          lovedBy: []
        };
        
        if (uploadedUrl) {
          newPost.imageUrl = uploadedUrl;
        }
        
        const stored = localStorage.getItem('siyam_sandbox_posts');
        const list = stored ? JSON.parse(stored) : [];
        const nextList = [newPost, ...list];
        localStorage.setItem('siyam_sandbox_posts', JSON.stringify(nextList));
        window.dispatchEvent(new Event('siyam_sandbox_posts_update'));
        
        setPostContent('');
        cancelAttachment();
        setUploadPercent(null);
        triggerToast('Post Shared (Sandbox)', 'Your mock update was instantly stored in the local sandbox database!', 'success');
        setIsSubmitting(false);
        return;
      }

      const postRef = doc(collection(db, 'posts'));
      const newPostData = {
        id: postRef.id,
        content: postContent,
        category: selectedCategory,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous Developer',
        authorEmail: currentUser.email || '',
        authorAvatar: currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.email || 'Siyaam'}`,
        createdAt: serverTimestamp(),
        lovesCount: 0,
        lovedBy: []
      };

      if (uploadedUrl) {
        (newPostData as any).imageUrl = uploadedUrl;
      }

      await setDoc(postRef, newPostData);
      
      // Reset form variables
      setPostContent('');
      cancelAttachment();
      setUploadPercent(null);
      triggerToast('Post Shared', 'Your update was securely propagated into the Firestore DB!', 'success');
    } catch (err: any) {
      triggerToast('Post Failed', err?.message || 'Transaction was rolled back.', 'error');
      setUploadPercent(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    if (isSandboxMode) {
      if (!window.confirm('Are you sure you want to delete this mock post from the Sandbox database?')) return;
      const stored = localStorage.getItem('siyam_sandbox_posts');
      if (stored) {
        const list = JSON.parse(stored);
        const nextList = list.filter((p: Post) => p.id !== postId);
        localStorage.setItem('siyam_sandbox_posts', JSON.stringify(nextList));
        window.dispatchEvent(new Event('siyam_sandbox_posts_update'));
        triggerToast('Post Deleted (Sandbox)', 'Target mock data and local comments references deleted.', 'success');
      }
      return;
    }

    if (!window.confirm('Are you sure you want to delete this post permanentally from Siyam\'s Feed?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      triggerToast('Post Deleted', 'Target document and references wiped.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  // Edit text post
  const handleStartEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditingContent(post.content);
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editingContent.trim()) {
      triggerToast('Blank Content', 'Cannot update post with blank text.', 'error');
      return;
    }

    if (isSandboxMode) {
      const stored = localStorage.getItem('siyam_sandbox_posts');
      if (stored) {
        const list = JSON.parse(stored);
        const nextList = list.map((p: Post) => p.id === postId ? { ...p, content: editingContent } : p);
        localStorage.setItem('siyam_sandbox_posts', JSON.stringify(nextList));
        window.dispatchEvent(new Event('siyam_sandbox_posts_update'));
        setEditingPostId(null);
        triggerToast('Post Updated (Sandbox)', 'Inline status description updated inside local state store.', 'success');
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'posts', postId), {
        content: editingContent
      });
      setEditingPostId(null);
      triggerToast('Post Updated', 'The status description was updated inline.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  // Love Reaction handler
  const handleToggleLove = async (post: Post) => {
    if (!currentUser) {
      triggerToast('Auth Required', 'You must sign in to react to updates!', 'error');
      return;
    }

    const { lovedBy, id, lovesCount } = post;

    if (isSandboxMode) {
      const stored = localStorage.getItem('siyam_sandbox_posts');
      if (stored) {
        const list = JSON.parse(stored);
        const nextList = list.map((p: Post) => {
          if (p.id === id) {
            const isLoved = p.lovedBy.includes(currentUser.uid);
            return {
              ...p,
              lovedBy: isLoved ? p.lovedBy.filter(u => u !== currentUser.uid) : [...p.lovedBy, currentUser.uid],
              lovesCount: isLoved ? Math.max(0, p.lovesCount - 1) : p.lovesCount + 1
            };
          }
          return p;
        });
        localStorage.setItem('siyam_sandbox_posts', JSON.stringify(nextList));
        window.dispatchEvent(new Event('siyam_sandbox_posts_update'));
      }
      return;
    }

    const isLoved = lovedBy.includes(currentUser.uid);
    const postDocRef = doc(db, 'posts', id);

    try {
      if (isLoved) {
        await updateDoc(postDocRef, {
          lovedBy: arrayRemove(currentUser.uid),
          lovesCount: Math.max(0, lovesCount - 1)
        });
      } else {
        await updateDoc(postDocRef, {
          lovedBy: arrayUnion(currentUser.uid),
          lovesCount: lovesCount + 1
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    }
  };

  const filteredPosts = activeTabFilter === 'All' 
    ? posts 
    : posts.filter(p => p.category === activeTabFilter);

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white flex items-center gap-2">
            Sahedur's Social Space Feed
            {isAdmin && (
              <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
                Verified Owner Mode
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A real-time, professional, server-authenticated posting stream powered by Firestore databases.
          </p>
        </div>

        {/* Category filtering */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/60 p-1 border border-white/5 rounded-xl">
          {(['All', 'Anime', 'Coding', 'Dhaka'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTabFilter(cat)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                activeTabFilter === cat 
                  ? 'bg-cyan-500 text-[#02050E] font-bold shadow-lg shadow-cyan-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              #{cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Publish status */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 relative overflow-hidden">
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Publish Fresh Post
            </h3>

            {currentUser ? (
              <form onSubmit={handleCreatePost} className="space-y-4">
                
                {/* Custom API Key input config */}
                <div className="bg-slate-950/40 p-3 rounded-lg border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Custom ImgBB Key (Optional)</span>
                    <button 
                      type="button" 
                      onClick={() => setIsKeyVisible(!isKeyVisible)}
                      className="text-cyan-400 hover:text-cyan-300 transition hover:underline"
                    >
                      {isKeyVisible ? 'Hide Key' : 'Show / Edit'}
                    </button>
                  </div>
                  {isKeyVisible && (
                    <input 
                      type="text" 
                      value={customKey}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setCustomKey(val);
                        localStorage.setItem('siyam_imgbb_key', val);
                      }}
                      className="w-full px-2 py-1 bg-slate-900 text-xs text-rose-300 border border-white/10 rounded-md focus:outline-none focus:border-cyan-500 text-[10px] font-mono"
                      placeholder="Leave blank to use preloaded fallback key"
                    />
                  )}
                  <p className="text-[9px] text-slate-500 leading-none">
                    Uploads directly to Cloud Storage and appends URLs automatically.
                  </p>
                </div>

                {/* Content Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">What is happening, developer?</label>
                  <textarea
                    rows={4}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="w-full p-3.5 rounded-xl glass-input text-xs sm:text-sm placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="Share academic progress, gaming highlights, programming insights or movie rants..."
                  />
                </div>

                {/* Theme Category Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">Attach category Tag</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Anime', 'Coding', 'Dhaka'] as const).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`py-1.5 text-xs font-mono rounded-lg border transition ${
                          selectedCategory === cat
                            ? 'bg-cyan-950/60 text-cyan-400 border-cyan-500/40 font-semibold'
                            : 'bg-[#02050E]/40 text-slate-400 border-white/5 hover:border-white/10'
                        }`}
                      >
                        #{cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drag and Drop File Selector Trigger */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">Insert Graphic Media</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-slate-800 hover:border-cyan-500/40 bg-[#050917]/30 hover:bg-slate-900/10 rounded-xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5 group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                      className="hidden" 
                      accept="image/*" 
                    />
                    <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition" />
                    <span className="text-xs text-slate-300">Click to import portfolio photo</span>
                    <span className="text-[10px] text-slate-500">Supports JPG, PNG, GIF up to 8MB</span>
                  </div>
                </div>

                {/* Attached file thumbnail info */}
                {filePreview && (
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={filePreview} className="w-12 h-12 rounded object-cover border border-white/10" alt="Attaching" />
                      <div>
                        <p className="text-xs text-slate-200 font-mono max-w-[150px] truncate">{attachedFile?.name}</p>
                        <p className="text-[10px] text-slate-500">{( (attachedFile?.size || 0) / 1024 / 1024 ).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={cancelAttachment}
                      className="p-1 px-2 text-xs bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900/30 transition rounded-lg"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Upload bar */}
                {uploadPercent !== null && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">ImgBB Cloud Sync:</span>
                      <span className="text-cyan-400">{uploadPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                      <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: `${uploadPercent}%` }}></div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-indigo-500 text-[#02050E] font-bold rounded-xl text-xs sm:text-sm hover:brightness-110 active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Syncing to Cloud...' : 'Post to Live Feed'}
                </button>

              </form>
            ) : (
              <div className="p-6 bg-slate-950/60 rounded-xl border border-white/5 text-center space-y-3">
                <ShieldAlert className="w-8 h-8 text-cyan-400 mx-auto" />
                <h4 className="text-sm font-bold text-white uppercase">Authentication Required</h4>
                <p className="text-xs text-slate-400">
                  Please sign up or log in to Siyam's Feed to write, React, and interact with the database!
                </p>
              </div>
            )}
          </div>

          <div className="glass-panel p-5 rounded-xl border border-white/10 text-xs text-slate-400 space-y-2.5">
            <h4 className="font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <FolderSync className="w-4 h-4 text-emerald-400" />
              Siyam's Feed Policies
            </h4>
            <p className="leading-relaxed">
              1. Sahedur Rahman Siyam (<span className="text-cyan-400">siyamrahman1268@gmail.com</span>) is the default supreme admin. Siyam has verified permissions to delete or edit anyone's posts or comments.
            </p>
            <p className="leading-relaxed">
              2. Free-tier Firestore rules guard database integrity instantly. No spam, no spoofing, no unauthorized mutations.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Stream of posts */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
            <span>Showing {filteredPosts.length} posts filtered</span>
            <span className="text-cyan-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              Live Subscription Sync Active
            </span>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => {
                  const isPostAuthor = currentUser && post.authorId === currentUser.uid;
                  const canManagePost = isPostAuthor || isAdmin;
                  const hasLoved = currentUser && post.lovedBy.includes(currentUser.uid);

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={post.id}
                      className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4"
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <img 
                            src={post.authorAvatar} 
                            className="w-10 h-10 rounded-full border border-white/10 bg-slate-950 object-cover" 
                            alt={post.authorName} 
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-100">{post.authorName}</span>
                              {post.authorEmail === 'siyamrahman1268@gmail.com' ? (
                                <span className="bg-yellow-400 text-slate-900 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 uppercase tracking-wide">
                                  <CheckCircle className="w-2.5 h-2.5 fill-slate-900" /> Owner/Admin
                                </span>
                              ) : (
                                <span className="bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 text-[9px] px-1.5 rounded uppercase tracking-wide">
                                  User
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 mt-0.5">
                              <span>#{post.category}</span>
                              <span>&middot;</span>
                              <span>
                                {(() => {
                                  if (!post.createdAt) return 'Syncing...';
                                  const date = typeof post.createdAt === 'string'
                                    ? new Date(post.createdAt)
                                    : (post.createdAt.seconds ? new Date(post.createdAt.seconds * 1000) : new Date());
                                  return date.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Edit delete context options */}
                        {canManagePost && (
                          <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 p-1 rounded-lg">
                            <button
                              onClick={() => handleStartEditing(post)}
                              className="p-1 px-1.5 hover:bg-white/5 text-slate-400 hover:text-white transition rounded cursor-pointer"
                              title="Edit post info"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="p-1 px-1.5 hover:bg-red-950/30 text-slate-400 hover:text-red-400 transition rounded cursor-pointer"
                              title="Delete post permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Editing state description */}
                      {editingPostId === post.id ? (
                        <div className="space-y-2 bg-[#02050E]/60 p-3 rounded-lg border border-white/5">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full bg-[#050917] hover:bg-[#02050E] border border-white/10 text-slate-200 text-xs sm:text-sm p-2 rounded-lg focus:outline-none focus:border-cyan-500 font-sans"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingPostId(null)}
                              className="px-2 py-1 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition rounded-md"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(post.id)}
                              className="px-3 py-1 text-xs text-slate-900 bg-cyan-400 font-bold hover:brightness-110 transition rounded-md"
                            >
                              Save Updates
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-line font-sans font-light">
                          {post.content}
                        </p>
                      )}

                      {/* Display Post Attached Image with Full Lightbox toggle */}
                      {post.imageUrl && (
                        <div className="relative group rounded-xl overflow-hidden border border-white/5 bg-slate-950/40">
                          <img 
                            src={post.imageUrl} 
                            className="max-h-[350px] w-full object-cover rounded-xl group-hover:scale-[1.01] transition-all duration-300"
                            alt="Media" 
                          />
                          <button
                            onClick={() => onViewImage(post.imageUrl!, `Post Graphic by ${post.authorName}`)}
                            className="absolute bottom-3 right-3 p-1.5 bg-black/80 hover:bg-black/95 text-cyan-400 border border-cyan-500/30 rounded-lg opacity-0 group-hover:opacity-100 transition duration-200 flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" /> View Cloud Mirror
                          </button>
                        </div>
                      )}

                      {/* Interactive Section: Hearts reactions and Comments Toggle */}
                      <div className="flex items-center justify-between border-t border-b border-white/5 py-2.5">
                        <button
                          onClick={() => handleToggleLove(post)}
                          className={`flex items-center gap-1.5 text-xs font-mono transition cursor-pointer ${
                            hasLoved ? 'text-rose-400 border-rose-500/30' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${hasLoved ? 'fill-rose-400' : ''}`} />
                          <span>Love {post.lovesCount > 0 && `(${post.lovesCount})`}</span>
                        </button>

                        <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
                          <MessageSquare className="w-4 h-4" />
                          <span>Conversation thread</span>
                        </div>
                      </div>

                      {/* Dedicated Subcollection Comments list */}
                      <PostCommentsSection 
                        postId={post.id} 
                        currentUser={currentUser} 
                        isAdmin={isAdmin} 
                        triggerToast={triggerToast} 
                      />

                    </motion.div>
                  );
                })
              ) : (
                <div className="glass-panel py-16 px-6 text-center space-y-4 rounded-3xl border border-dashed border-white/10">
                  <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-base font-bold text-slate-300">Nothing Published Under #{activeTabFilter} Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    The queue is currently empty. Login and write the very first update to record persistent entries in Firestore!
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}

// Subcomponent focusing on real-time Comments derived directly under each Post!
interface PostCommentsSectionProps {
  postId: string;
  currentUser: any;
  isAdmin: boolean;
  triggerToast: (title: string, msg: string, type: 'success' | 'error' | 'info') => void;
  isSandboxMode?: boolean;
}

const MOCK_COMMENT_POST_2 = [
  {
    id: "mock_c_1",
    postId: "mock_post_2",
    content: "Thank god for sandbox bypass! Now I can test full-stack dashboards instantly! 🔥",
    authorId: "mock_user_1",
    authorName: "Nafis Anjum",
    authorEmail: "nafis@gmail.com",
    authorAvatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Nafis",
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

function PostCommentsSection({ postId, currentUser, isAdmin, triggerToast, isSandboxMode }: PostCommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Subscribe to post comments
  useEffect(() => {
    if (isSandboxMode) {
      const initComments = () => {
        const stored = localStorage.getItem(`siyam_sandbox_comments_${postId}`);
        if (stored) {
          setComments(JSON.parse(stored));
        } else {
          const defaults = postId === 'mock_post_2' ? MOCK_COMMENT_POST_2 : [];
          localStorage.setItem(`siyam_sandbox_comments_${postId}`, JSON.stringify(defaults));
          setComments(defaults);
        }
      };
      
      initComments();
      
      const handleEvent = () => {
        const stored = localStorage.getItem(`siyam_sandbox_comments_${postId}`);
        if (stored) setComments(JSON.parse(stored));
      };
      window.addEventListener(`siyam_sandbox_comments_update_${postId}`, handleEvent);
      
      return () => {
        window.removeEventListener(`siyam_sandbox_comments_update_${postId}`, handleEvent);
      };
    } else {
      const commentsColRef = collection(db, 'posts', postId, 'comments');
      const q = query(commentsColRef, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const commentsData: Comment[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          commentsData.push({
            id: doc.id,
            postId: d.postId || postId,
            content: d.content || '',
            authorId: d.authorId || '',
            authorName: d.authorName || '',
            authorEmail: d.authorEmail || '',
            authorAvatar: d.authorAvatar || '',
            createdAt: d.createdAt
          });
        });
        setComments(commentsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `posts/${postId}/comments`);
      });

      return () => unsubscribe();
    }
  }, [postId, isSandboxMode]);

  // Handle comment submit
  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      triggerToast('Auth Required', 'Please register or login to write comments.', 'error');
      return;
    }
    if (!newCommentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      if (isSandboxMode) {
        const stored = localStorage.getItem(`siyam_sandbox_comments_${postId}`);
        const list = stored ? JSON.parse(stored) : [];
        const newComment: Comment = {
          id: `c_${Date.now()}`,
          postId,
          content: newCommentText.trim(),
          authorId: currentUser.uid,
          authorName: currentUser.displayName || 'Anonymous Developer',
          authorEmail: currentUser.email || '',
          authorAvatar: currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.email || 'Siyam'}`,
          createdAt: new Date().toISOString()
        };
        
        const nextList = [...list, newComment];
        localStorage.setItem(`siyam_sandbox_comments_${postId}`, JSON.stringify(nextList));
        window.dispatchEvent(new Event(`siyam_sandbox_comments_update_${postId}`));
        setNewCommentText('');
        setIsSubmittingComment(false);
        return;
      }

      const commentDocRef = doc(collection(db, 'posts', postId, 'comments'));
      const newComment = {
        id: commentDocRef.id,
        postId,
        content: newCommentText.trim(),
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous Developer',
        authorEmail: currentUser.email || '',
        authorAvatar: currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.email || 'Siyaam'}`,
        createdAt: serverTimestamp()
      };

      await setDoc(commentDocRef, newComment);
      setNewCommentText('');
    } catch (err: any) {
      triggerToast('Comment Failed', err?.message || 'Transaction aborted.', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle comment delete
  const handleDeleteComment = async (commentId: string) => {
    if (isSandboxMode) {
      if (!window.confirm('Delete this comment from local Sandbox?')) return;
      const stored = localStorage.getItem(`siyam_sandbox_comments_${postId}`);
      if (stored) {
        const list = JSON.parse(stored);
        const nextList = list.filter((c: Comment) => c.id !== commentId);
        localStorage.setItem(`siyam_sandbox_comments_${postId}`, JSON.stringify(nextList));
        window.dispatchEvent(new Event(`siyam_sandbox_comments_update_${postId}`));
        triggerToast('Comment Deleted', 'Mock comment deleted from local viewport.', 'success');
      }
      return;
    }

    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      triggerToast('Comment Deleted', 'Cloud comment record permanently deleted.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
    }
  };

  return (
    <div className="space-y-3.5 bg-slate-950/40 p-3 sm:p-4 rounded-xl border border-white/5 text-left">
      <h5 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
        Replies ({comments.length})
      </h5>

      {/* Render comments */}
      {comments.length > 0 && (
        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
          {comments.map((comm) => {
            const isCommentOwner = currentUser && comm.authorId === currentUser.uid;
            const canManageComment = isCommentOwner || isAdmin;

            return (
              <div key={comm.id} className="flex gap-2.5 bg-white/[0.01] border border-white/5 p-2 rounded-lg relative group">
                <img 
                  src={comm.authorAvatar} 
                  className="w-7 h-7 rounded-full object-cover border border-white/5 bg-slate-900" 
                  alt={comm.authorName} 
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-200">{comm.authorName}</span>
                      {comm.authorEmail === 'siyamrahman1268@gmail.com' && (
                        <span className="bg-yellow-400/10 text-yellow-400 border border-yellow-500/20 text-[8px] font-bold px-1 rounded">
                          Owner
                        </span>
                      )}
                    </div>
                    {canManageComment && (
                      <button
                        onClick={() => handleDeleteComment(comm.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 rounded transition cursor-pointer"
                        title="Delete key comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 font-sans break-words font-light">
                    {comm.content}
                   </p>
                  <p className="text-[9px] font-mono text-slate-500">
                    {(() => {
                      if (!comm.createdAt) return 'Sending...';
                      const date = typeof comm.createdAt === 'string'
                        ? new Date(comm.createdAt)
                        : (comm.createdAt.seconds ? new Date(comm.createdAt.seconds * 1000) : new Date());
                      return date.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    })()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Put custom comment input */}
      {currentUser ? (
        <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1 border-t border-white/5">
          <input
            type="text"
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            disabled={isSubmittingComment}
            className="flex-1 bg-slate-950 border border-white/10 hover:border-white/20 text-xs text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 font-sans placeholder-slate-600"
            placeholder="Write a public response..."
          />
          <button
            type="submit"
            disabled={isSubmittingComment || !newCommentText.trim()}
            className="p-1.5 bg-cyan-950 text-cyan-400 border border-cyan-800/60 hover:bg-cyan-900 rounded-lg cursor-pointer disabled:opacity-45"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        <p className="text-[10px] text-slate-500 text-center italic">
          Sign in to participate in comments thread.
        </p>
      )}

    </div>
  );
}
