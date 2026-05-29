const Anthropic = require('@anthropic-ai/sdk');
const storage  = require('./storage');
const linkedin = require('./linkedin');
const path     = require('path');
const fs       = require('fs');

const REPLIED_FILE = path.join(__dirname, '..', 'data', 'replied_comments.json');

function loadReplied() {
  if (!fs.existsSync(REPLIED_FILE)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(REPLIED_FILE, 'utf-8')));
}
function saveReplied(set) {
  fs.writeFileSync(REPLIED_FILE, JSON.stringify([...set], null, 2));
}

// ── Trivial detector ──────────────────────────────────────────────────────────
// Comments that are generic praise/reaction → no AI needed
const TRIVIAL_RE = /^[\s!.,🙏👍❤️🙌🔥💯✨🎉👏😊🤝]*(?:nice|great|awesome|amazing|good|cool|wow|love\s*it|well\s*done|superb|brilliant|excellent|perfect|interesting|helpful|congrats|congratulations|thanks|thank\s*you|true|absolutely|indeed|agree|exactly|spot\s*on|100%|so\s*true|yes|yep|sure|👍|❤️|🙌|🔥|💯|✨|🎉|👏|😊|🤝|🙏)[\s!.,]*$/i;

const CANNED = [
  'Thank you so much! Really appreciate it! 🙏',
  'Glad you found it valuable! 😊',
  'Means a lot — thank you! 🙌',
  'Appreciate the kind words! 🙏',
  'Thanks for the support! 😊',
  'So glad this resonated with you! 🙌',
];

function isTrivial(text) {
  const t = text.trim();
  return t.length < 25 || TRIVIAL_RE.test(t);
}

let cannedIdx = 0;
function cannedReply() {
  // Rotate through canned replies so they don't all look identical
  return CANNED[cannedIdx++ % CANNED.length];
}

// Safely truncate text without slicing inside a UTF-16 surrogate pair.
// LinkedIn post text often contains mathematical-bold chars (𝗜𝗻𝘃𝗲𝗻𝘁𝗼𝗿𝘆) which
// are 2 code units each; raw .slice() can leave a lone high surrogate and the
// Anthropic API rejects the JSON body with "no low surrogate" error.
function safeSlice(s, n) {
  if (!s) return '';
  let out = s.slice(0, n);
  // If the last char is a high surrogate, drop it (avoid orphaned half)
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xD800 && last <= 0xDBFF) out = out.slice(0, -1);
  return out;
}

// ── AI call: substantive comments only, batched, minimal prompt ───────────────
async function generateReplies(postText, comments) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Compressed format: "1.FirstName:comment text" — no quotes, no extra spaces
  const list = comments
    .map((c, i) => `${i + 1}.${safeSlice(c.authorName.split(' ')[0], 30)}:${safeSlice(c.text, 300)}`)
    .join('\n');

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: Math.min(120 * comments.length, 800),  // 120 tokens/reply, was 60 (too tight)
    messages: [{
      role: 'user',
      content:
`Post:"${safeSlice(postText, 80)}"
Comments below. Write a warm 1-2 sentence reply to each — no greeting, no preamble.
Output ONLY a JSON array of plain strings (no objects, no markdown, no code fences).
Example output: ["Reply to first comment","Reply to second comment"]

${list}`
    }]
  });

  const raw = res.content[0].text.trim();

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // Match the first JSON array (greedy to get the full thing, not first ])
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array in response: ${raw.slice(0, 120)}`);

  let parsed;
  try { parsed = JSON.parse(match[0]); }
  catch (e) { throw new Error(`Bad JSON: ${e.message} | raw: ${raw.slice(0, 120)}`); }

  // Accept either ["str", "str"] OR [{reply:"str"}, {reply:"str"}] OR [{text:"..."}] etc.
  const replies = parsed.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return item.reply || item.text || item.message || Object.values(item)[0] || '';
    return '';
  }).filter(Boolean);

  if (replies.length !== comments.length)
    throw new Error(`Count mismatch: ${replies.length} vs ${comments.length}`);
  return replies;
}

// Build a set of "self" identities — our user, our pages — so we never reply
// to our own comments/replies (which would cause an infinite reply loop).
function loadSelfIdentities() {
  const names = new Set();
  try {
    const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'profile.json'), 'utf-8'));
    if (profile.name) names.add(profile.name.toLowerCase().trim());
  } catch {}
  try {
    const pages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'pages.json'), 'utf-8'));
    (pages.identities || []).forEach(p => p.name && names.add(p.name.toLowerCase().trim()));
  } catch {}
  return names;
}

// Reject things the parser misreads as comments:
//   - "2 Replies on …'s comment" (the expand-replies link)
//   - "5 reactions", "12 likes" (metadata blocks)
//   - empty / numeric-only authors
function isJunkComment(c) {
  const a = (c.authorName || '').trim();
  const t = (c.text || '').trim();
  if (!a || !t) return true;

  // LinkedIn "expand replies" affordance — author parsed as e.g. "2 replies"
  // and text as "2 Replies on X's comment". The number INCREMENTS each cycle
  // (because our replies add to the count), generating new comment-ID hashes
  // every cycle. Bug history: this caused 3 duplicate replies on the Nokia
  // post because regex only caught "replies" not "comment(s)".
  if (/^\d+\s*(replies?|reactions?|likes?|comments?)\b/i.test(a)) return true;
  if (/^\d+\s*(replies?|comments?)\s+on\b/i.test(t)) return true;
  if (/\b(View|Load|Show)\s+(more\s+)?(\d+\s+)?(replies?|comments?)\b/i.test(t)) return true;
  if (/^(View|Load|Show)\s/i.test(a)) return true;

  // UI action labels misparsed as comment text
  if (/^reply$/i.test(t) || /^like$/i.test(t)) return true;

  // Pure metadata slipping through (e.g. "2 Likes", "5 reactions")
  if (/^\d+\s*(likes?|reactions?|impressions?|views?)$/i.test(t)) return true;

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runCommentCheck() {
  const replied   = loadReplied();
  const selfNames = loadSelfIdentities();
  const now       = Date.now();
  const published = storage.getPublishedPosts()
    .filter(p => p.publishedAt && (now - new Date(p.publishedAt).getTime()) <= 48 * 3_600_000);

  if (!published.length) {
    console.log('[Monitor] No posts in the last 48h');
    return { checked: 0, replied: 0 };
  }

  let totalReplied = 0;

  for (const post of published) {
    if (!post.linkedinPostId) continue;
    console.log(`[Monitor] Checking ${post.id}`);

    let comments = [];
    try {
      comments = await linkedin.getPostComments(post.linkedinPostId);
    } catch (err) {
      if (err.message === 'POST_DELETED') {
        console.log(`[Monitor] Post ${post.id} deleted on LinkedIn — removing from monitor`);
        storage.updatePost(post.id, { linkedinDeleted: true });
      } else {
        console.error(`[Monitor] Fetch failed: ${err.message}`);
      }
      continue;
    }

    const fresh = comments.filter(c => {
      if (c.id === 'debug_error' || replied.has(c.id)) return false;
      if (isJunkComment(c)) {
        console.log(`[Monitor] Skipping junk: "${(c.authorName || '?')}": "${(c.text || '').slice(0, 40)}"`);
        return false;
      }
      if (selfNames.has((c.authorName || '').toLowerCase().trim())) {
        console.log(`[Monitor] Skipping own reply from "${c.authorName}"`);
        replied.add(c.id);  // permanently mark so we don't re-check it next cycle
        return false;
      }
      return true;
    });
    saveReplied(replied);   // persist any "self" markers we just added

    if (!fresh.length) { console.log('[Monitor] No new comments'); continue; }

    // Split by effort needed
    const trivial     = fresh.filter(c =>  isTrivial(c.text));
    const substantive = fresh.filter(c => !isTrivial(c.text));

    const replyMap = new Map();
    trivial.forEach(c => replyMap.set(c.id, cannedReply()));

    if (substantive.length) {
      console.log(`[Monitor] ${trivial.length} canned + ${substantive.length} AI (1 call)`);
      try {
        const aiReplies = await generateReplies(post.text, substantive);
        substantive.forEach((c, i) => replyMap.set(c.id, aiReplies[i]));
      } catch (err) {
        console.error(`[Monitor] AI failed: ${err.message} — falling back to canned`);
        substantive.forEach(c => replyMap.set(c.id, cannedReply()));
      }
    } else {
      console.log(`[Monitor] ${trivial.length} trivial — 0 AI tokens used`);
    }

    for (const comment of fresh) {
      const reply = replyMap.get(comment.id);
      if (!reply) continue;
      try {
        console.log(`[Monitor] → ${comment.authorName}: ${reply.slice(0, 55)}…`);
        await linkedin.replyToComment(post.linkedinPostId, comment.id, reply, comment.text);
        replied.add(comment.id);
        saveReplied(replied);
        storage.logComment(post.id, comment, reply);
        totalReplied++;
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        if (err.code === 'ALREADY_REPLIED') {
          // DOM check found an existing reply from us — sync local state and move on
          console.log(`[Monitor] Already replied on LinkedIn — syncing local state for ${comment.authorName}`);
          replied.add(comment.id);
          saveReplied(replied);
        } else {
          console.error(`[Monitor] Reply failed: ${err.message}`);
        }
      }
    }
  }

  return { checked: published.length, replied: totalReplied };
}

module.exports = { runCommentCheck };
