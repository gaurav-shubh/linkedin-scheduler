"""
LinkedIn Comment Monitor Agent — Playwright-based (no API keys needed)

Monitoring schedule after each post is published:
  - Every 1 hour  → first 3 hours
  - Every 2 hours → next 4 hours  (hours 3-7)
  - Every 4 hours → next 8 hours  (hours 7-15)
Then stops.
"""

import os, sys, json, time, logging
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright
import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s [Monitor] %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger(__name__)

POSTS_FILE    = Path(__file__).parent.parent / 'data' / 'posts.json'
COMMENTS_LOG  = Path(__file__).parent.parent / 'data' / 'comments.json'
REPLIED_FILE  = Path(__file__).parent.parent / 'data' / 'replied_comments.json'
SESSION_FILE  = Path(__file__).parent.parent / 'data' / 'session.json'


class CommentMonitor:
    def __init__(self):
        self.claude   = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.replied  = self._load_replied()
        self.pw       = None
        self.browser  = None
        self.context  = None

    def __enter__(self):
        self.pw      = sync_playwright().start()
        self.browser = self.pw.chromium.launch(headless=True)
        state        = str(SESSION_FILE) if SESSION_FILE.exists() else None
        self.context = self.browser.new_context(storage_state=state)
        return self

    def __exit__(self, *_):
        if self.browser: self.browser.close()
        if self.pw:      self.pw.stop()

    def _load_replied(self):
        return set(json.loads(REPLIED_FILE.read_text())) if REPLIED_FILE.exists() else set()

    def _save_replied(self):
        REPLIED_FILE.write_text(json.dumps(list(self.replied), indent=2))

    def get_published_posts(self):
        if not POSTS_FILE.exists(): return []
        return [p for p in json.loads(POSTS_FILE.read_text())
                if p.get('status') == 'published' and p.get('linkedinPostId')]

    def hours_since(self, post):
        published = datetime.fromisoformat(post['publishedAt'].replace('Z', '+00:00'))
        return (datetime.now(published.tzinfo) - published).total_seconds() / 3600

    def check_interval(self, post):
        h = self.hours_since(post)
        if h <= 3:  return 3600
        if h <= 7:  return 7200
        if h <= 15: return 14400
        return None

    def should_monitor(self, post):
        return self.hours_since(post) <= 15

    def get_comments(self, activity_id):
        page = self.context.new_page()
        try:
            page.goto(f'https://www.linkedin.com/feed/update/urn:li:activity:{activity_id}/',
                      wait_until='domcontentloaded')
            page.wait_for_timeout(2500)

            # Load all comments
            while True:
                btn = page.locator('button:has-text("Load more comments")')
                if not btn.is_visible(): break
                btn.click()
                page.wait_for_timeout(1000)

            comments = page.evaluate("""() => {
                const items = [];
                document.querySelectorAll('.comments-comment-item').forEach(el => {
                    const id   = el.getAttribute('data-id') || el.id || String(Math.random());
                    const text = el.querySelector('.comments-comment-item__main-content')?.innerText?.trim() || '';
                    const name = el.querySelector('.comments-post-meta__name-text')?.innerText?.trim() || 'Someone';
                    if (text) items.push({ id, text, authorName: name });
                });
                return items;
            }""")
            return comments
        except Exception as e:
            log.error(f'  Failed to fetch comments: {e}')
            return []
        finally:
            page.close()

    def reply_to_comment(self, activity_id, comment_id, reply_text):
        page = self.context.new_page()
        try:
            page.goto(f'https://www.linkedin.com/feed/update/urn:li:activity:{activity_id}/',
                      wait_until='domcontentloaded')
            page.wait_for_timeout(2000)

            comment_el = page.locator(f'[data-id="{comment_id}"]').first()
            reply_btn  = comment_el.locator('button:has-text("Reply")').first()
            reply_btn.click()
            page.wait_for_timeout(800)

            editor = comment_el.locator('[contenteditable="true"]').first()
            editor.click()
            editor.type(reply_text)
            page.wait_for_timeout(500)

            submit = comment_el.locator('button[type="submit"], button:has-text("Post")').last()
            submit.click()
            page.wait_for_timeout(1500)
            return True
        except Exception as e:
            log.error(f'  Reply failed: {e}')
            return False
        finally:
            page.close()

    def generate_reply(self, post_text, comment_text, commenter_name):
        res = self.claude.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=120,
            messages=[{"role": "user", "content":
                f"Reply to this LinkedIn comment in 1-2 sentences. Be warm, natural, and reference what they said. No greeting. No quotes.\n\n"
                f"Your post: {post_text[:400]}\n\n"
                f"{commenter_name} said: \"{comment_text}\"\n\nReply:"}]
        )
        return res.content[0].text.strip()

    def log_reply(self, post_id, comment, reply):
        log_data = json.loads(COMMENTS_LOG.read_text()) if COMMENTS_LOG.exists() else []
        log_data.append({
            'postId': post_id,
            'commentId': comment['id'],
            'commentText': comment['text'],
            'commenterName': comment['authorName'],
            'reply': reply,
            'repliedAt': datetime.now().isoformat()
        })
        COMMENTS_LOG.write_text(json.dumps(log_data, indent=2))

    def process_post(self, post):
        activity_id = post['linkedinPostId']
        log.info(f"Checking: {post['id']} (activity: {activity_id})")

        comments     = self.get_comments(activity_id)
        new_comments = [c for c in comments if c['id'] not in self.replied]

        if not new_comments:
            log.info('  No new comments')
            return

        log.info(f'  {len(new_comments)} new comment(s)')
        for comment in new_comments:
            log.info(f'  → {comment["authorName"]}: {comment["text"][:60]}...')
            reply = self.generate_reply(post['text'], comment['text'], comment['authorName'])
            log.info(f'  ← {reply[:60]}...')

            ok = self.reply_to_comment(activity_id, comment['id'], reply)
            if ok:
                self.replied.add(comment['id'])
                self._save_replied()
                self.log_reply(post['id'], comment, reply)
            time.sleep(2)

    def run_once(self):
        posts = [p for p in self.get_published_posts() if self.should_monitor(p)]
        if not posts:
            log.info('No active posts to monitor')
            return
        for post in posts:
            self.process_post(post)

    def run_daemon(self):
        log.info('Daemon started — 1h → 2h → 4h decaying schedule')
        while True:
            posts = [p for p in self.get_published_posts() if self.should_monitor(p)]
            if not posts:
                log.info('No active posts — checking again in 30 min')
                time.sleep(1800)
                continue

            for post in posts:
                self.process_post(post)

            intervals = [i for i in (self.check_interval(p) for p in posts) if i]
            if not intervals:
                log.info('All posts past monitoring window. Done.')
                break

            wait = min(intervals)
            log.info(f'Next check in {wait/3600:.1f}h')
            time.sleep(wait)


def main():
    if not SESSION_FILE.exists():
        print('ERROR: No LinkedIn session found.')
        print('Click "Connect LinkedIn" in the dashboard first (http://localhost:3000)')
        sys.exit(1)

    if not os.getenv('ANTHROPIC_API_KEY'):
        print('ERROR: ANTHROPIC_API_KEY not set in .env')
        sys.exit(1)

    with CommentMonitor() as monitor:
        if '--once' in sys.argv:
            monitor.run_once()
        else:
            monitor.run_daemon()


if __name__ == '__main__':
    main()
