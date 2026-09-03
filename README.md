# DM Test Bench

A small Next.js app for sending and inspecting **legacy X API v1.1 Direct Message** requests. Built to reproduce partner bugs like NPS vs CSAT feedback-card rendering in XChat.

## What it covers

| Area | Endpoints |
| --- | --- |
| Feedback cards | `POST /1.1/feedback/create.json`, `GET /show/:id`, `GET /events`, `POST /submit/:id`, `POST /dismiss/:id` |
| Send DM | `POST /1.1/direct_messages/events/new.json` (text, URL preview, media, quick replies, CTAs, location, custom profile) |
| Inbox | `GET events/list`, `GET events/show`, `DELETE events/destroy`, `POST mark_read`, `POST indicate_typing` |
| Welcome messages | new / show / list / update / destroy |
| Welcome rules | new / show / list / destroy |
| Custom profiles | new / `:id` / list / destroy |
| Media | `upload.twitter.com/1.1/media/upload.json` (simple + chunked) |
| Lookup | `GET /1.1/users/show.json` |

NPS and CSAT create forms include every official question variant (NPS 0–9, CSAT 0–37).

## Setup

```bash
cp .env.example .env.local
```

Fill in OAuth 1.0a **user-context** credentials for the sending account:

```
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
```

The sending app/user needs:

- DM write access for events, welcome messages, and media
- `feedback_api` client privilege **and** the `feedback_api_access_create` role to create NPS/CSAT cards
- Custom-profile allowlisting to create custom profiles

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Reproduce the NPS card bug

1. Look up the recipient handle and set their user ID.
2. On **Feedback cards**, send a **CSAT** card (`Fill CSAT control`). Confirm it renders in XChat.
3. Send an **NPS** card (`Fill NPS repro`). The recipient should see a raw card GUID instead of the 0–10 survey.

`test=true` is on by default so creates stay out of analytics.

## Deploy to Vercel

Connect this repo and set the four env vars in the Vercel project. No extra build config is required.
