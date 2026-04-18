# Ascend Deals — Instagram Publisher

A React + Netlify Functions app to publish and schedule Instagram posts for **@ascend.deals**.

---

## Setup (5 minutes)

### 1. Clone & install

```bash
git clone <your-repo>
cd instagram-publisher
npm install
npm install -g netlify-cli
```

### 2. Set environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the three values:

| Variable | Where to get it |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Graph API Explorer → Generate Token (see below) |
| `INSTAGRAM_USER_ID` | Graph API Explorer → run `GET /me?fields=id` after connecting IG account |
| `IMGBB_API_KEY` | Free at [imgbb.com/api](https://api.imgbb.com/) — just sign up |

### 3. Run locally

```bash
netlify dev
```

Opens at `http://localhost:8888`

### 4. Deploy to Netlify

```bash
netlify deploy --prod
```

Then add your env vars in **Netlify Dashboard → Site Settings → Environment Variables**.

---

## Getting Your Instagram Token

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an App → Business type
3. Add the **Instagram Graph API** product
4. Connect your Instagram account (must be Creator or Business)
5. Go to **Tools → Graph API Explorer**
6. Select your app, click **Generate Access Token**
7. Add permissions: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
8. Copy the token into `INSTAGRAM_ACCESS_TOKEN`

**Getting your User ID:**
In Graph API Explorer, run:
```
GET /me?fields=id,username
```
Copy the `id` value into `INSTAGRAM_USER_ID`.

---

## Architecture

```
/
├── src/                    # React frontend
│   ├── App.jsx             # Main app shell + tab nav
│   ├── App.css             # Dark theme styles
│   └── components/
│       ├── PostComposer.jsx  # Upload + caption + publish
│       └── PostHistory.jsx   # Published post log
│
├── netlify/functions/      # Serverless backend
│   ├── upload-media.js     # Hosts image on imgbb → returns public URL
│   ├── publish.js          # Creates IG container → publishes/schedules
│   └── account-info.js     # Fetches IG account info
│
├── netlify.toml            # Build + redirect config
└── .env.example            # Environment variable template
```

---

## Notes

- Instagram requires images to be hosted at a **public URL** — the `upload-media` function handles this via imgbb (free, no account needed beyond API key).
- **Scheduling** uses the Instagram Graph API's `scheduled_publish_time` field. The account must have Content Publishing API access.
- Videos are published as **Reels** (Instagram deprecated feed video).
- Access tokens expire after ~60 days. Refresh via the [Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/).
