const { parseISO, isPast } = require('date-fns');
const storage = require('./storage');
const linkedin = require('./linkedin');

let schedulerInterval = null;

function startScheduler() {
  console.log('[Scheduler] Started — checking every 30s for posts to publish');

  schedulerInterval = setInterval(async () => {
    // Only pick up posts that are explicitly 'scheduled' — not publishing/published/failed
    const posts = storage.getScheduledPosts();

    for (const post of posts) {
      const scheduledTime = parseISO(post.scheduledAt);
      if (!isPast(scheduledTime)) continue;

      // Lock it immediately so next tick doesn't pick it up again
      storage.updatePost(post.id, { status: 'publishing' });
      console.log(`[Scheduler] Publishing: ${post.id}`);

      try {
        const linkedinPostId = await publishPost(post);
        storage.updatePost(post.id, {
          status: 'published',
          publishedAt: new Date().toISOString(),
          linkedinPostId: linkedinPostId || null
        });
        console.log(`[Scheduler] Published: ${post.id} → ${linkedinPostId}`);
      } catch (err) {
        console.error(`[Scheduler] Failed: ${post.id} —`, err.message);
        // Put back to scheduled so user can retry, but add error note
        storage.updatePost(post.id, {
          status: 'failed',
          error: err.message
        });
      }
    }
  }, 30_000);
}

async function publishPost(post) {
  // Pass identity through so the composer switches to the right page before posting
  const opts = { postAsPageId: post.postAsPageId || null };
  switch (post.type) {
    case 'text':
      return await linkedin.createTextPost(post.text, opts);
    case 'image':
    case 'mixed':
      return await linkedin.createImagePost(post.text, post.imagePaths, opts);
    case 'carousel':
      return await linkedin.createCarouselPost(post.text, post.documentPath, post.carouselTitle, opts);
    default:
      throw new Error(`Unknown post type: ${post.type}`);
  }
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

async function publishNow(postId) {
  const post = storage.getPostById(postId);
  if (!post) throw new Error(`Post not found: ${postId}`);
  if (post.status === 'published') throw new Error('Already published');
  if (post.status === 'publishing') throw new Error('Already being published');

  storage.updatePost(postId, { status: 'publishing' });
  try {
    const linkedinPostId = await publishPost(post);
    storage.updatePost(postId, {
      status: 'published',
      publishedAt: new Date().toISOString(),
      linkedinPostId: linkedinPostId || null
    });
    return linkedinPostId;
  } catch (err) {
    storage.updatePost(postId, { status: 'failed', error: err.message });
    throw err;
  }
}

module.exports = { startScheduler, stopScheduler, publishNow };
