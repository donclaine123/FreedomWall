'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { ArrowDownWideNarrow, ArrowRight, Check, Globe2, Heart, ImagePlus, Info, LoaderCircle, MessageSquare, MessagesSquare, PencilLine, RefreshCw, Send, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AUTHOR_NAME, MAX_CHARACTERS, mergePosts, validateMessage, type Post } from '@/lib/posts';
import { getSupabase } from '@/lib/supabase';
import { loadLocalPosts, loadPosts, publishPost, saveLocalPost, STORAGE_KEY } from '@/lib/wall-store';
import { getPhotoUrl, PHOTO_TYPES, uploadPhoto, validatePhoto } from '@/lib/photos';

function Avatar({ small = false }: { small?: boolean }) {
  return <span className={`avatar ${small ? 'avatar-small' : ''}`} aria-hidden="true">wv<span /></span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function PostPhoto({ path }: { path: string }) {
  const client = getSupabase();
  const url = client ? getPhotoUrl(client, path) : null;
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <p className="photo-unavailable">This photo couldn’t be loaded.</p>;
  return <a className="post-photo" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open shared photo in a new tab"><Image src={url} alt={`Photo shared by ${AUTHOR_NAME}`} width={720} height={540} unoptimized loading="lazy" onError={() => setFailed(true)} /></a>;
}

export function Wall() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'checking' | 'local' | 'supabase' | 'error'>('checking');
  const [live, setLive] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const uploadedPhoto = useRef<{ file: File; path: string } | null>(null);
  const submitting = useRef(false);
  const count = Array.from(message).length;
  const validationError = validateMessage(message, !!photo);

  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationError = validatePhoto(file);
    if (validationError) { setError(validationError); return; }
    setCheckingPhoto(true);
    setNotice('');
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      setPhoto(file);
      uploadedPhoto.current = null;
      setError('');
    } catch {
      setError('This file could not be read as a photo. Please choose another.');
    } finally {
      setCheckingPhoto(false);
    }
  }

  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    setLoading(true);
    setError('');
    setLive(false);

    try {
      const client = getSupabase();
      setMode(client ? 'supabase' : 'local');
      const sync = async () => {
        try {
          const data = client ? await loadPosts(client) : loadLocalPosts(window.localStorage);
          if (active) {
            setPosts(current => client ? mergePosts(current, data) : data);
            setError('');
          }
        } catch (cause) {
          if (active) setError(cause instanceof Error ? cause.message : 'The wall could not be loaded. Please try again.');
        } finally {
          if (active) setLoading(false);
        }
      };
      void sync();

      if (client) {
        const channel = client.channel('public-wall')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
            if (active) setPosts(current => mergePosts(current, [payload.new as Post]));
          })
          .subscribe(status => {
            if (!active) return;
            setLive(status === 'SUBSCRIBED');
            // Re-fetch on connection/reconnection to catch inserts missed while offline.
            if (status === 'SUBSCRIBED') void sync();
          });
        cleanup = () => { void client.removeChannel(channel); };
      } else {
        const onStorage = (event: StorageEvent) => {
          if (event.key === STORAGE_KEY || event.key === null) void sync();
        };
        window.addEventListener('storage', onStorage);
        cleanup = () => window.removeEventListener('storage', onStorage);
      }
    } catch (cause) {
      setMode('error');
      setError(cause instanceof Error ? cause.message : 'Check your Supabase configuration.');
      setLoading(false);
    }

    return () => { active = false; cleanup(); };
  }, [refreshToken]);

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || checkingPhoto) return;
    if (validationError) { setError(validationError); return; }
    submitting.current = true;
    setSharing(true);
    setError('');
    setNotice('');
    try {
      const client = getSupabase();
      let imagePath: string | undefined;
      if (photo) {
        if (!client) throw new Error('Connect Supabase to share photos.');
        // shortcut: abandoned uploads need admin cleanup; reuse uploads during retries.
        if (uploadedPhoto.current?.file !== photo) uploadedPhoto.current = { file: photo, path: await uploadPhoto(client, photo) };
        imagePath = uploadedPhoto.current.path;
      }
      const post = client ? await publishPost(client, message, imagePath) : saveLocalPost(window.localStorage, message);
      setPosts(current => mergePosts(current, [post]));
      setMessage('');
      setPhoto(null);
      uploadedPhoto.current = null;
      setNotice(client ? 'Your message is on the wall!' : 'Shared in this local preview. Saved in this browser.');
      textarea.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your message could not be saved. Please try again.');
    } finally {
      submitting.current = false;
      setSharing(false);
    }
  }

  function tryPrompt() {
    setMessage('One small thing that made my day: ');
    setNotice('');
    textarea.current?.focus();
  }

  return <>
    <a className="skip-link" href="#wall">Skip to the wall</a>
    <header className="topbar">
      <div className="topbar-inner">
        <a className="wordmark" href="#wall" aria-label="Freedom Wall home">freedom<span>wall</span><span className="wordmark-period">.</span></a>
        <nav aria-label="Main navigation" className="top-nav">
          <a className="active" href="#wall"><MessageSquare size={15} aria-hidden="true" />The Wall</a>
          <a href="#about">About</a>
        </nav>
        <span className="header-note"><Globe2 size={14} aria-hidden="true" /> A wall for everyone</span>
        <div className="header-user"><Avatar small /><span>{AUTHOR_NAME}</span></div>
      </div>
    </header>

    <div className="page-shell">
      <aside className="left-sidebar" aria-label="Your wall">
        <div className="profile-tile"><div className="profile-art" aria-hidden="true"><MessagesSquare size={66} strokeWidth={1.4} /><span className="art-star">✳</span><span className="art-dot" /></div>
          <h2>Freedom Wall</h2><p>A little more connected.</p>
        </div>
        <nav className="side-nav" aria-label="Wall navigation">
          <a href="#wall" className="selected" aria-current="page"><MessagesSquare size={18} aria-hidden="true" />The Wall<span className="nav-count">{loading ? '–' : posts.length}</span></a>
          <a href="#composer" onClick={() => textarea.current?.focus()}><PencilLine size={18} aria-hidden="true" />Write something</a>
          <a href="#about"><Info size={18} aria-hidden="true" />About this space</a>
        </nav>
        <div className="sidebar-note"><span className="eyebrow">GOOD TO SEE YOU HERE</span><p>No friend requests.<br />No perfect profiles.<br />Just a place to say something.</p><span className="little-line" /></div>
        <div className="sidebar-footer">Made for the good old days.<br /><span>Rebuilt for right now.</span></div>
      </aside>

      <main id="wall" className="main-column">
        <div className="page-heading"><div><div className="eyebrow blue-text">YOUR SHARED CORNER OF THE INTERNET</div><h1>The Wall<span className="heading-dot">.</span></h1><p>Small thoughts. Big feelings. Everyone’s welcome.</p></div><span className="year-tag">a little 2008 energy ↗</span></div>

        <div className="welcome-banner"><span className="banner-icon" aria-hidden="true"><Sparkles size={23} /></span><div><strong>Remember when we just wrote on each other’s walls?</strong><p>Let’s bring a little of that back. Leave a thought, a story, or just a hello.</p></div></div>

        <section id="composer" className="composer panel" aria-labelledby="composer-title">
          <div className="panel-heading"><PencilLine size={16} aria-hidden="true" /><h2 id="composer-title">Write on the wall</h2></div>
          <form onSubmit={share}>
            <div className="composer-body"><Avatar /><div className="composer-field"><label htmlFor="message">What’s on your mind?</label><Textarea ref={textarea} id="message" name="message" placeholder="A thought, a little life update, a very good joke…" value={message} disabled={sharing} onChange={event => { setMessage(Array.from(event.target.value).slice(0, MAX_CHARACTERS).join('')); setNotice(''); }} aria-describedby="character-count public-note" /><div className="posting-as">Posting as <strong>{AUTHOR_NAME}</strong></div></div></div>
            <div className="photo-attachment"><input ref={photoInput} type="file" accept={Object.keys(PHOTO_TYPES).join(',')} onChange={choosePhoto} className="sr-only" aria-label="Choose a photo" disabled={sharing || checkingPhoto || mode !== 'supabase'} tabIndex={-1} />
              <div className="photo-controls"><Button type="button" variant="ghost" disabled={sharing || checkingPhoto || loading || mode !== 'supabase'} onClick={() => photoInput.current?.click()}>{checkingPhoto ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}{photo ? 'Change photo' : 'Add photo'}</Button><span>{mode === 'local' ? 'Connect Supabase to share photos' : 'JPG, PNG, WebP or GIF · up to 5 MB'}</span></div>
              {photo && <div className="photo-preview">{photoPreview && <Image src={photoPreview} alt="Selected photo preview" width={640} height={480} unoptimized />}<div className="photo-preview-caption"><span>{photo.name}</span><Button type="button" variant="ghost" disabled={sharing} aria-label="Remove photo" onClick={() => { setPhoto(null); uploadedPhoto.current = null; }}><X aria-hidden="true" />Remove</Button></div></div>}
            </div>
            <div className="composer-footer"><span id="public-note"><Globe2 size={13} aria-hidden="true" />{mode === 'local' ? 'Local preview only' : 'Public · visible to everyone'}</span><div className="share-actions"><span id="character-count" className={count >= 260 ? 'counter near-limit' : 'counter'} aria-live="polite">{count}<span> / {MAX_CHARACTERS}</span></span><Button type="submit" disabled={!!validationError || sharing || checkingPhoto || loading || mode === 'error'}>{sharing ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}{sharing ? 'Sharing…' : 'Share'}</Button></div></div>
          </form>
        </section>

        {error && <div role="alert" className="feedback feedback-error"><Info size={17} aria-hidden="true" /><span>{error}</span><Button variant="ghost" onClick={() => setRefreshToken(value => value + 1)} disabled={loading}>Retry</Button></div>}
        <div role="status" className={notice ? 'feedback feedback-success' : 'sr-only'}>{notice && <Check size={17} aria-hidden="true" />}{notice}</div>

        <section className="feed" aria-labelledby="feed-title" aria-busy={loading}>
          <div className="feed-header"><h2 id="feed-title">On the wall <span>{posts.length}</span></h2><div className="feed-tools"><span><ArrowDownWideNarrow size={14} aria-hidden="true" />Newest first</span><button className="refresh-button" aria-label="Refresh posts" disabled={loading} onClick={() => setRefreshToken(value => value + 1)}><RefreshCw size={15} className={loading ? 'motion-safe:animate-spin' : ''} aria-hidden="true" /></button></div></div>
          {loading && posts.length === 0 && <div className="empty-state panel" role="status"><LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /><p>Getting the wall ready…</p></div>}
          {!loading && posts.length === 0 && !error && <div className="empty-state panel"><MessagesSquare size={34} aria-hidden="true" /><h3>Every wall starts with a hello.</h3><p>Be the first to leave a little something.</p><Button variant="ghost" onClick={() => textarea.current?.focus()}>Write the first post <ArrowRight aria-hidden="true" /></Button></div>}
          <div className="post-list">{posts.map(post => <article className="post panel" key={post.id}>
            <Avatar /><div className="post-body"><div className="post-heading"><h3>{AUTHOR_NAME}</h3><span className="post-label">{post.id.startsWith('demo-') ? 'Sample post' : 'wrote on the wall'}</span></div>{post.body && <p className="post-message">{post.body}</p>}{post.image_path && <PostPhoto path={post.image_path} />}<div className="post-meta"><Globe2 size={12} aria-label="Public post" /><time dateTime={post.created_at}>{formatDate(post.created_at)}</time><span className="meta-dot">·</span><span>Wall post</span></div></div>
          </article>)}</div>
          {posts.length > 0 && <div className="feed-end"><span /><Heart size={13} aria-hidden="true" /><p>You’re all caught up. Go make a little memory.</p><span /></div>}
        </section>
      </main>

      <aside className="right-sidebar" aria-label="About the wall">
        <div className="connection-status"><span className={`status-dot ${live ? 'is-live' : ''}`} /><span>{mode === 'local' ? 'Local preview' : mode === 'error' ? 'Configuration needed' : live ? 'The wall is live' : mode === 'supabase' ? 'Connecting live updates…' : 'Getting connected…'}</span></div>
        <section id="about" className="about-card panel"><div className="mini-browser" aria-hidden="true"><div className="browser-bar"><i /><i /><i /></div><div className="browser-doodle"><MessagesSquare size={46} strokeWidth={1.3} /><span className="doodle-heart"><Heart size={18} fill="currentColor" /></span><span className="doodle-spark">✧</span></div><div className="browser-caption">hello, old friend.</div></div><div className="about-body"><span className="eyebrow">A FAMILIAR FEELING</span><h2>Less algorithm.<br />More us.</h2><p>A nod to simpler days on the internet. One shared wall for thoughts, tiny victories, and everything in between.</p><div className="about-tag"><Users size={14} aria-hidden="true" />No account needed. Just you.</div></div></section>
        <section className="wall-rules"><h2><ShieldCheck size={16} aria-hidden="true" />A few house rules</h2><p><Check size={14} aria-hidden="true" />Be kind. There’s a person reading.</p><p><Check size={14} aria-hidden="true" />Keep it short. 280 is plenty.</p><p><Check size={14} aria-hidden="true" />Share thoughts, not private details.</p></section>
        <section className="prompt-card"><span className="eyebrow">NEED A LITTLE NUDGE?</span><p>What’s one small thing<br />that made your day?</p><button onClick={tryPrompt} disabled={sharing}>Start with this <ArrowRight size={14} aria-hidden="true" /></button></section>
        {mode === 'local' && <p className="preview-note">You’re in local preview. Posts stay in this browser until you connect Supabase.</p>}
        <p className="right-footer">A small space. A shared story.<br /><span>Freedom Wall © {new Date().getFullYear()}</span></p>
      </aside>
    </div>
    <footer className="bottom-note"><span className="footer-mark">fw.</span>Some things are better when we share them.</footer>
  </>;
}
