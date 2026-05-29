// override:true forces .env to win over pre-existing env vars (the user's shell
// has ANTHROPIC_API_KEY="" exported, which would otherwise mask our real key).
require('dotenv').config({ override: true });
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const storage   = require('./storage');
const linkedin  = require('./linkedin');
const { startScheduler, publishNow } = require('./scheduler');
const { formatTextPost, generatePreview, generateHTMLPreview } = require('./formatter');
const { runCommentCheck } = require('./commentAgent');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Preserve the original file extension on disk — LinkedIn's media editor
// sniffs extensions and rejects files like `abc123` with no suffix as
// "unsupported content type". Saving as `abc123.jpg` (or .pdf) fixes that.
const uploadStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    cb(null, hash + ext);
  }
});
const upload = multer({ storage: uploadStorage });

// ── Auth ──────────────────────────────────────────────────────────────────────
app.get('/auth/status', async (req, res) => {
  const ok = await linkedin.isLoggedIn();
  res.json({ loggedIn: ok });
});

app.get('/api/profile', (req, res) => {
  res.json(linkedin.getProfile());
});

// Triggers the visible-browser login flow (run once)
app.post('/auth/login', async (req, res) => {
  res.json({ message: 'Login window opened — please log in and close it.' });
  linkedin.login().catch(err => console.error('[Login]', err.message));
});

// ── Post scheduling ───────────────────────────────────────────────────────────
app.post('/api/posts/schedule', upload.array('media', 10), (req, res) => {
  const { text, type, scheduledAt, hashtags, cta, carouselTitle,
          postAsPageId, postAsPageName } = req.body;

  if (!text)        return res.status(400).json({ error: 'text is required' });
  if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });

  const formattedText = formatTextPost(text, {
    hashtags: hashtags ? JSON.parse(hashtags) : [],
    cta: cta || null
  });

  // Support pre-uploaded draft files (paths already on server)
  const draftImagePaths  = req.body.draftImagePaths  ? JSON.parse(req.body.draftImagePaths)  : [];
  const draftDocPath     = req.body.draftDocumentPath || null;

  const post = {
    text: formattedText,
    type: type || 'text',
    scheduledAt,
    carouselTitle: carouselTitle || null,
    imagePaths:   req.files?.length ? req.files.map(f => f.path) : draftImagePaths,
    documentPath: req.files?.[0]?.path || draftDocPath || null,
    postAsPageId:   postAsPageId   || null,
    postAsPageName: postAsPageName || null
  };

  const saved = storage.addPost(post);
  res.json({ message: 'Post scheduled', post: saved });
});

app.get('/api/posts', (req, res) => {
  const { status } = req.query;
  let posts = storage.getPosts();
  if (status) posts = posts.filter(p => p.status === status);
  res.json(posts);
});

app.get('/api/posts/:id', (req, res) => {
  const post = storage.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

app.delete('/api/posts/:id', (req, res) => {
  const post = storage.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.status === 'published') return res.status(400).json({ error: 'Cannot delete published post' });
  storage.updatePost(req.params.id, { status: 'cancelled' });
  res.json({ message: 'Post cancelled' });
});

app.post('/api/posts/:id/publish-now', async (req, res) => {
  try {
    const result = await publishNow(req.params.id);
    res.json({ message: 'Published!', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Formatting & Preview ──────────────────────────────────────────────────────
app.post('/api/format', (req, res) => {
  const { text, hashtags, cta, addLineBreaks, addHook } = req.body;
  const formatted = formatTextPost(text, { hashtags, cta, addLineBreaks, addHook });
  const preview   = generatePreview(formatted);
  res.json({ formatted, preview });
});

app.post('/api/preview', (req, res) => {
  const { text, type, scheduledAt } = req.body;
  const html = generateHTMLPreview({ text, type, scheduledAt });
  res.type('html').send(html);
});

// ── Retry a failed post ───────────────────────────────────────────────────────
app.post('/api/posts/:id/retry', (req, res) => {
  const post = storage.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  storage.retryPost(req.params.id);
  res.json({ message: 'Post reset to scheduled' });
});

// Hard-delete a single post (any terminal status)
app.delete('/api/posts/:id/remove', (req, res) => {
  const post = storage.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (post.status === 'scheduled' || post.status === 'publishing')
    return res.status(400).json({ error: 'Cannot delete an active post' });
  storage.removePost(req.params.id);
  res.json({ message: 'Deleted' });
});

// Bulk-delete all posts of a given status
app.delete('/api/posts/bulk/:status', (req, res) => {
  const allowed = ['published', 'failed', 'cancelled'];
  if (!allowed.includes(req.params.status))
    return res.status(400).json({ error: 'Invalid status' });
  storage.removePostsByStatus(req.params.status);
  res.json({ message: `All ${req.params.status} posts deleted` });
});

// Mark a failed post as published (when it actually went live but verification failed)
app.post('/api/posts/:id/mark-published', (req, res) => {
  const post = storage.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  storage.updatePost(req.params.id, {
    status: 'published',
    publishedAt: new Date().toISOString(),
    error: null
  });
  res.json({ message: 'Marked as published' });
});

// ── Pages ("Post as" identities) ──────────────────────────────────────────────
// Returns the cached list of LinkedIn identities (personal profile + any
// Company / Showcase pages the user can post as). If nothing has been
// cached yet, returns an empty list — the client should then call
// /api/pages/refresh to do a one-time scrape.
app.get('/api/pages', (req, res) => {
  const cache = linkedin.readPagesCache();
  res.json(cache || { scrapedAt: null, identities: [] });
});

// Opens Edge briefly, scrapes the identity picker, caches the result.
// Called on first use or when the user clicks "Refresh pages".
app.post('/api/pages/refresh', async (req, res) => {
  try {
    const payload = await linkedin.scrapePages();
    res.json(payload);
  } catch (err) {
    console.error('[Pages]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Drafts ────────────────────────────────────────────────────────────────────
app.get('/api/drafts', (req, res) => {
  res.json(storage.getDrafts());
});

app.post('/api/drafts', (req, res) => {
  const draft = storage.createDraft(req.body);
  res.json(draft);
});

app.put('/api/drafts/:id', (req, res) => {
  const draft = storage.updateDraft(req.params.id, req.body);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json(draft);
});

app.delete('/api/drafts/:id', (req, res) => {
  if (!storage.getDraftById(req.params.id)) return res.status(404).json({ error: 'Draft not found' });
  storage.deleteDraft(req.params.id);
  res.json({ message: 'Deleted' });
});

// Upload files attached to a draft
app.post('/api/drafts/:id/upload', upload.array('files', 10), (req, res) => {
  const draft = storage.getDraftById(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files' });

  const paths    = req.files.map(f => f.path);
  const names    = req.files.map(f => f.originalname);
  const isDoc    = req.files[0].mimetype === 'application/pdf';

  let updates;
  if (isDoc) {
    updates = { documentPath: paths[0], attachedFileNames: [names[0]] };
  } else {
    updates = {
      imagePaths:        [...(draft.imagePaths || []), ...paths],
      attachedFileNames: [...(draft.attachedFileNames || []), ...names]
    };
  }

  const updated = storage.updateDraft(req.params.id, updates);
  res.json({ draft: updated, paths, names });
});

// Remove a specific attached file from a draft
app.delete('/api/drafts/:id/upload/:fileIdx', (req, res) => {
  const draft = storage.getDraftById(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  const idx   = parseInt(req.params.fileIdx);
  const names = (draft.attachedFileNames || []).filter((_, i) => i !== idx);
  const paths = (draft.imagePaths || []).filter((_, i) => i !== idx);
  storage.updateDraft(req.params.id, { imagePaths: paths, attachedFileNames: names });
  res.json({ ok: true });
});

// ── Comment monitor ───────────────────────────────────────────────────────────
let monitorRunning = false;

app.post('/api/monitor/check-now', async (req, res) => {
  if (monitorRunning) return res.json({ message: 'Check already running...' });
  res.json({ message: 'Comment check started' });
  monitorRunning = true;
  try {
    await runCommentCheck();
    // Stamp lastCommentCheck on all active posts
    const now = new Date().toISOString();
    const TWO_DAYS_MS = 48 * 3_600_000;
    storage.getPublishedPosts()
      .filter(p => p.publishedAt && (Date.now() - new Date(p.publishedAt).getTime()) <= TWO_DAYS_MS)
      .forEach(p => storage.updatePost(p.id, { lastCommentCheck: now }));
  } catch (e) { console.error('[Monitor]', e.message); }
  monitorRunning = false;
});

app.get('/api/monitor/status', (req, res) => {
  res.json({ running: monitorRunning });
});

// Stats for the stats bar
app.get('/api/monitor/stats', (req, res) => {
  const now         = Date.now();
  const TWO_DAYS_MS = 48 * 3_600_000;
  const commentLog  = storage.getCommentLog();

  const activePosts = storage.getPublishedPosts()
    .filter(p => p.publishedAt && !p.linkedinDeleted && (now - new Date(p.publishedAt).getTime()) <= TWO_DAYS_MS);

  const activeMonitored = activePosts.filter(p => {
    const h = (now - new Date(p.publishedAt).getTime()) / 3_600_000;
    return h <= 48;
  });

  const lastChecks = activePosts
    .filter(p => p.lastCommentCheck)
    .map(p => new Date(p.lastCommentCheck).getTime());
  const lastCheckTime = lastChecks.length ? new Date(Math.max(...lastChecks)).toISOString() : null;

  res.json({
    totalReplies: commentLog.length,
    activePosts:  activeMonitored.length,
    lastCheckTime
  });
});

// Published posts from last 2 days with their comment replies
app.get('/api/monitor/posts', (req, res) => {
  const TWO_DAYS_MS = 48 * 3_600_000;
  const now = Date.now();

  const posts = storage.getPublishedPosts()
    .filter(p => p.publishedAt && !p.linkedinDeleted && (now - new Date(p.publishedAt).getTime()) <= TWO_DAYS_MS)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const commentLog = storage.getCommentLog();

  const result = posts.map(p => {
    const hoursAgo = (now - new Date(p.publishedAt).getTime()) / 3_600_000;
    let monitorStatus, nextCheck;
    if      (hoursAgo <= 3)  { monitorStatus = 'active'; nextCheck = 'every 1h'; }
    else if (hoursAgo <= 9)  { monitorStatus = 'active'; nextCheck = 'every 3h'; }
    else if (hoursAgo <= 48) { monitorStatus = 'active'; nextCheck = 'every 6h'; }
    else                     { monitorStatus = 'ended';  nextCheck = null; }

    const replies = commentLog.filter(c => c.postId === p.id);
    return {
      ...p,
      hoursAgo: Math.round(hoursAgo * 10) / 10,
      monitorStatus,
      nextCheck,
      replies
    };
  });

  res.json(result);
});

// Auto-monitoring — actually runs on the decaying schedule
function startCommentMonitor() {
  setInterval(async () => {
    if (monitorRunning) return;

    const now         = Date.now();
    const TWO_DAYS_MS = 48 * 3_600_000;
    const posts       = storage.getPublishedPosts()
      .filter(p => p.publishedAt && !p.linkedinDeleted && (now - new Date(p.publishedAt).getTime()) <= TWO_DAYS_MS);

    // Find any post that is due for a check
    const isDue = posts.some(p => {
      const ageHrs  = (now - new Date(p.publishedAt).getTime()) / 3_600_000;
      let ivMs;
      if      (ageHrs <= 3)  ivMs = 1 * 3_600_000;
      else if (ageHrs <= 9)  ivMs = 3 * 3_600_000;
      else if (ageHrs <= 48) ivMs = 6 * 3_600_000;
      else return false;

      const lastCheck = p.lastCommentCheck ? new Date(p.lastCommentCheck).getTime() : 0;
      return (now - lastCheck) >= ivMs;
    });

    if (!isDue) return;

    monitorRunning = true;
    console.log('[AutoMonitor] Scheduled check running…');
    try {
      await runCommentCheck();
      const stamp = new Date().toISOString();
      posts.forEach(p => storage.updatePost(p.id, { lastCommentCheck: stamp }));
    } catch (e) { console.error('[AutoMonitor]', e.message); }
    monitorRunning = false;
  }, 60_000); // evaluate every minute
}

// ── Comment log ───────────────────────────────────────────────────────────────
app.get('/api/comments/log', (req, res) => {
  res.json(storage.getCommentLog());
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  LinkedIn Scheduler → http://localhost:${PORT}`);
  console.log(`  First time? Click "Connect LinkedIn" in the dashboard.\n`);
  startScheduler();
  startCommentMonitor();
  console.log('  Comment auto-monitor started (checks every 60s on decaying schedule)\n');
  // Scrape profile once if not cached (runs in background, doesn't block startup)
  linkedin.scrapeProfileIfNeeded().catch(() => {});
});
