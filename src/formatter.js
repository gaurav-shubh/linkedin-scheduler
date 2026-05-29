const LINKEDIN_MAX_CHARS = 3000;
const LINKEDIN_PREVIEW_CHARS = 210;

function formatTextPost(text, options = {}) {
  let formatted = text;

  if (options.addLineBreaks) {
    formatted = formatted.replace(/\. /g, '.\n\n');
  }

  if (options.addHook && !formatted.startsWith('🔥') && !formatted.startsWith('💡')) {
    const firstLine = formatted.split('\n')[0];
    const rest = formatted.slice(firstLine.length);
    formatted = firstLine.toUpperCase() + rest;
  }

  if (options.hashtags && options.hashtags.length > 0) {
    const hashtagLine = '\n\n' + options.hashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ');
    formatted += hashtagLine;
  }

  if (options.cta) {
    formatted += `\n\n${options.cta}`;
  }

  return formatted;
}

function generatePreview(text) {
  const lines = text.split('\n');
  const charCount = text.length;
  const isTruncated = charCount > LINKEDIN_PREVIEW_CHARS;
  const previewText = isTruncated
    ? text.slice(0, LINKEDIN_PREVIEW_CHARS) + '...'
    : text;

  return {
    fullText: text,
    previewText,
    charCount,
    maxChars: LINKEDIN_MAX_CHARS,
    isTruncated,
    lineCount: lines.length,
    willShowSeeMore: isTruncated,
    hookLine: lines[0] || '',
    estimatedReadTime: Math.ceil(text.split(/\s+/).length / 200) + ' min'
  };
}

function generateHTMLPreview(post) {
  const preview = generatePreview(post.text || '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LinkedIn Post Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f3f2ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; display: flex; justify-content: center; }
    .feed-container { max-width: 555px; width: 100%; }
    .post-card {
      background: white; border-radius: 8px; border: 1px solid #e0e0e0;
      padding: 16px; margin-bottom: 8px;
    }
    .post-header {
      display: flex; align-items: center; margin-bottom: 12px;
    }
    .avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: #0a66c2; display: flex; align-items: center;
      justify-content: center; color: white; font-weight: bold; font-size: 18px;
      margin-right: 8px;
    }
    .author-info { flex: 1; }
    .author-name { font-weight: 600; font-size: 14px; color: #000; }
    .author-headline { font-size: 12px; color: #666; }
    .post-time { font-size: 12px; color: #666; }
    .post-text {
      font-size: 14px; line-height: 1.5; color: #000;
      white-space: pre-wrap; word-wrap: break-word;
    }
    .see-more { color: #666; cursor: pointer; font-weight: 500; }
    .post-image { width: 100%; margin-top: 12px; border-radius: 4px; }
    .carousel-indicator {
      background: #f0f0f0; padding: 40px; text-align: center;
      border-radius: 4px; margin-top: 12px; color: #666;
    }
    .post-stats {
      display: flex; justify-content: space-between;
      padding: 8px 0; border-bottom: 1px solid #e0e0e0;
      font-size: 12px; color: #666; margin-top: 12px;
    }
    .post-actions {
      display: flex; justify-content: space-around; padding-top: 4px;
    }
    .action-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 12px 8px; color: #666; font-size: 14px; font-weight: 600;
      border: none; background: none; cursor: pointer; border-radius: 4px;
    }
    .action-btn:hover { background: #f0f0f0; }
    .meta-info {
      background: #e8f4fd; border-radius: 8px; padding: 12px; margin-bottom: 16px;
      font-size: 13px; color: #0a66c2;
    }
    .meta-info strong { display: block; margin-bottom: 4px; }
    .char-count { color: ${preview.charCount > LINKEDIN_MAX_CHARS ? '#cc0000' : '#666'}; }
  </style>
</head>
<body>
  <div class="feed-container">
    <div class="meta-info">
      <strong>Post Preview Info</strong>
      Characters: <span class="char-count">${preview.charCount} / ${preview.maxChars}</span> |
      Lines: ${preview.lineCount} |
      Read time: ${preview.estimatedReadTime} |
      "See more": ${preview.willShowSeeMore ? 'Yes' : 'No'}<br>
      Type: ${post.type || 'text'} |
      Scheduled: ${post.scheduledAt || 'Not set'}
    </div>
    <div class="post-card">
      <div class="post-header">
        <div class="avatar">Y</div>
        <div class="author-info">
          <div class="author-name">Your Name</div>
          <div class="author-headline">Your headline</div>
          <div class="post-time">Just now</div>
        </div>
      </div>
      <div class="post-text">${escapeHtml(preview.willShowSeeMore ? preview.previewText : preview.fullText)}${preview.willShowSeeMore ? ' <span class="see-more">...see more</span>' : ''}</div>
      ${post.type === 'image' ? '<div class="carousel-indicator">📷 Image attachment</div>' : ''}
      ${post.type === 'carousel' ? '<div class="carousel-indicator">📑 Carousel document (swipeable slides)</div>' : ''}
      <div class="post-stats">
        <span>👍 ❤️ 0</span>
        <span>0 comments · 0 reposts</span>
      </div>
      <div class="post-actions">
        <button class="action-btn">👍 Like</button>
        <button class="action-btn">💬 Comment</button>
        <button class="action-btn">🔄 Repost</button>
        <button class="action-btn">✈️ Send</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { formatTextPost, generatePreview, generateHTMLPreview };
