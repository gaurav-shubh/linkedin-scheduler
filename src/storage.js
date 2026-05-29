const fs = require('fs');
const path = require('path');

const POSTS_FILE    = path.join(__dirname, '..', 'data', 'posts.json');
const COMMENTS_FILE = path.join(__dirname, '..', 'data', 'comments.json');
const DRAFTS_FILE   = path.join(__dirname, '..', 'data', 'drafts.json');

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getPosts() {
  return readJSON(POSTS_FILE);
}

function addPost(post) {
  const posts = getPosts();
  post.id = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  post.status = 'scheduled';
  post.createdAt = new Date().toISOString();
  post.linkedinPostId = null;
  post.comments = [];
  posts.push(post);
  writeJSON(POSTS_FILE, posts);
  return post;
}

function updatePost(id, updates) {
  const posts = getPosts();
  const idx = posts.findIndex(p => p.id === id);
  if (idx === -1) return null;
  posts[idx] = { ...posts[idx], ...updates };
  writeJSON(POSTS_FILE, posts);
  return posts[idx];
}

function getScheduledPosts() {
  // Only return 'scheduled' — never 'publishing' (in-progress) or terminal states
  return getPosts().filter(p => p.status === 'scheduled');
}

function retryPost(id) {
  return updatePost(id, { status: 'scheduled', error: null });
}

function getPublishedPosts() {
  return getPosts().filter(p => p.status === 'published');
}

function getPostById(id) {
  return getPosts().find(p => p.id === id) || null;
}

function getCommentLog() {
  return readJSON(COMMENTS_FILE);
}

function logComment(postId, comment, reply) {
  const log = getCommentLog();
  log.push({
    postId,
    commentId: comment.id,
    commentText: comment.text,
    commenterName: comment.authorName,
    reply,
    repliedAt: new Date().toISOString()
  });
  writeJSON(COMMENTS_FILE, log);
}

function removePost(id) {
  writeJSON(POSTS_FILE, getPosts().filter(p => p.id !== id));
}

function removePostsByStatus(...statuses) {
  writeJSON(POSTS_FILE, getPosts().filter(p => !statuses.includes(p.status)));
}

// ── Drafts ────────────────────────────────────────────────────────────────────
function getDrafts() {
  return readJSON(DRAFTS_FILE).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getDraftById(id) {
  return readJSON(DRAFTS_FILE).find(d => d.id === id) || null;
}

function createDraft(data = {}) {
  const drafts = readJSON(DRAFTS_FILE);
  const draft  = {
    id:        `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text:      data.text      || '',
    type:      data.type      || 'text',
    hashtags:  data.hashtags  || [],
    cta:       data.cta       || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  drafts.push(draft);
  writeJSON(DRAFTS_FILE, drafts);
  return draft;
}

function updateDraft(id, updates) {
  const drafts = readJSON(DRAFTS_FILE);
  const idx    = drafts.findIndex(d => d.id === id);
  if (idx === -1) return null;
  drafts[idx] = { ...drafts[idx], ...updates, updatedAt: new Date().toISOString() };
  writeJSON(DRAFTS_FILE, drafts);
  return drafts[idx];
}

function deleteDraft(id) {
  writeJSON(DRAFTS_FILE, readJSON(DRAFTS_FILE).filter(d => d.id !== id));
}

module.exports = {
  getPosts, addPost, updatePost,
  getScheduledPosts, getPublishedPosts, getPostById,
  getCommentLog, logComment,
  retryPost, removePost, removePostsByStatus,
  getDrafts, getDraftById, createDraft, updateDraft, deleteDraft
};
