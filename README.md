# DM Test Bench

A small Next.js app for sending and inspecting **legacy X API v1.1 Direct Message** requests. Built to reproduce partner bugs like NPS vs CSAT feedback-card rendering in XChat.

Sign in with X via **3-legged OAuth 1.0a**. Those v1.1 endpoints do not accept OAuth 2.0 user tokens.

## What it covers

| Area | Endpoints |
| --- | --- |
| Feedback cards | `POST /1.1/feedback/create.json`, `GET /show/:id`, `GET /events`, `POST /submit/:id`, `POST /dismiss/:id` |
| Send DM | `POST /1.1/direct_messages/events/new.json` (text, URL preview, media, quick replies, CTAs, location, custom profile) |
| Inbox | `GET events/list`, `GET events/show`, `DELETE events/destroy`, `POST mark_read`, `POST indicate_typing` |
| Welcome messages | new / show / list / update / destroy |
| Welcome rules | new / show / list / destroy |
| Custom profiles | new / `:id` / list / destroy |
| Media | `POST /2/media/upload` (images); `initialize` / `{id}/append` / `{id}/finalize` / `STATUS` (video) |
| Lookup | `GET /1.1/users/show.json` |

NPS and CSAT create forms include every official question variant (NPS 0–9, CSAT 0–37).

## Setup

1. In the [X Developer Console](https://console.x.com), open your app → **User authentication settings**.
2. Turn on **OAuth 1.0a**.
3. App permissions: **Read and write and Direct message**.
4. Callback URLs:
   - `http://localhost:3000/api/auth/callback`
   - `https://<your-vercel-host>/api/auth/callback`
5. Copy the **API Key** and **API Secret** (consumer keys).

```bash
cp .env.example .env.local
```

```
X_API_KEY=
X_API_SECRET=
```

Optional: `X_REDIRECT_URI` if the auto-detected callback does not match the console. `SESSION_SECRET` to encrypt the login cookie (otherwise `X_API_SECRET` is used).

Feedback create still needs the `feedback_api` client privilege and `feedback_api_access_create` on the signed-in user.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Sign in with X**.

## Reproduce the NPS card bug

1. Sign in as the sending account.
2. Look up the recipient handle and set their user ID.
3. On **Feedback cards**, send a **CSAT** card (`Fill CSAT control`). Confirm it renders in XChat.
4. Send an **NPS** card (`Fill NPS repro`). The recipient should see a raw card GUID instead of the 0–10 survey.

`test=true` is on by default so creates stay out of analytics.

## Deploy to Vercel

Connect this repo and set `X_API_KEY` and `X_API_SECRET`. Add the Vercel URL as an OAuth 1.0a callback in the X app settings. You can remove any leftover `X_CLIENT_ID` / `X_CLIENT_SECRET` vars.
