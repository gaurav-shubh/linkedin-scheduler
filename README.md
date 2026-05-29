# LinkedIn Scheduler

A self-hosted LinkedIn post scheduler with a web dashboard, AI-powered comment replies, and automated comment monitoring.

## Features

- **Post Scheduling** — Schedule text, image, carousel, and PDF posts to LinkedIn at any date/time
- **Web Dashboard** — Clean UI to create, preview, edit, and manage all scheduled/published posts
- **Drafts** — Save work-in-progress posts with attached media
- **Post as Pages** — Post from your personal profile or any LinkedIn Company/Showcase page you manage
- **AI Comment Monitor** — Automatically detects new comments on your posts and replies using Claude AI (Anthropic)
- **Decaying Monitor Schedule** — Checks comments every 1h (first 3h), every 3h (3–9h), every 6h (9–48h)
- **Media Support** — Attach images (up to 10) or a PDF document to any post
- **Post Formatting** — Auto-adds hashtags, CTAs, and line breaks to posts
- **Publish Now** — Instantly publish any scheduled or draft post

## Tech Stack

- **Backend:** Node.js, Express
- **Automation:** Playwright (headless browser for LinkedIn)
- **AI:** Anthropic Claude API (comment replies)
- **Scheduler:** node-cron
- **Frontend:** Vanilla HTML/CSS/JS dashboard

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A LinkedIn account
- An [Anthropic API key](https://console.anthropic.com/) (for AI comment replies)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/gaurav-shubh/linkedin-scheduler.git
cd linkedin-scheduler
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/callback
LINKEDIN_ACCESS_TOKEN=

ANTHROPIC_API_KEY=your_anthropic_api_key

PORT=3000
```

> Get LinkedIn credentials from the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps).

### 4. Start the server

```bash
npm start
```

Or with live reload:

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

### 5. Connect LinkedIn

On first launch, click **"Connect LinkedIn"** in the dashboard. A browser window will open — log in to LinkedIn and close it. Your session is saved automatically.

## Usage

### Scheduling a Post

1. Open the dashboard at `http://localhost:3000`
2. Write your post content
3. Optionally attach images or a PDF
4. Pick a date and time
5. Click **Schedule**

### Comment Monitor

The comment monitor runs automatically in the background once the server starts. It:
- Checks comments on posts published within the last 48 hours
- Generates contextual replies using Claude AI
- Posts replies directly on LinkedIn

You can also trigger a manual check from the **Monitor** tab in the dashboard.

### Posting as a Company Page

1. Go to the **Pages** tab and click **Refresh Pages**
2. Select the desired identity (personal or company page) when scheduling a post

## Project Structure

```
linkedin-scheduler/
├── src/
│   ├── server.js        # Express app & API routes
│   ├── scheduler.js     # Cron-based post publisher
│   ├── linkedin.js      # Playwright LinkedIn automation
│   ├── commentAgent.js  # AI comment monitor & reply agent
│   ├── formatter.js     # Post text formatter
│   └── storage.js       # JSON file-based storage
├── agent/
│   ├── monitor.py       # Python comment monitor (alternative)
│   └── requirements.txt
├── public/
│   └── dashboard.html   # Web UI
├── data/                # Runtime JSON storage (gitignored)
├── uploads/             # Uploaded media files (gitignored)
├── .env.example         # Environment variable template
└── package.json
```

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with live reload |
| `npm run schedule` | Run scheduler standalone |

## Notes

- All post data is stored locally in `data/` as JSON files — no database required
- The LinkedIn session (cookies) is stored in `data/browser-profile/` — keep it private
- The `.env` file is gitignored — never commit your credentials

## License

MIT
