"use client";

import { useEffect, useMemo, useState } from "react";
import { CSAT_VARIANTS, NPS_VARIANTS, questionText } from "@/lib/variants";
import {
  buildMessageData,
  emptyDraft,
  type Cta,
  type MessageDraft,
  type QuickReplyOption,
} from "@/lib/message-data";
import type { ProxyRequest, ProxyResult } from "@/lib/x-client";
import { Button, Card, Field } from "./ui";

type Section =
  | "overview"
  | "send"
  | "feedback"
  | "welcome"
  | "rules"
  | "profiles"
  | "media"
  | "inbox"
  | "lookup";

type Status = {
  configured: boolean;
  signedIn?: boolean;
  user: { id?: string; screenName?: string; name?: string; avatar?: string } | null;
  error?: unknown;
};

const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "send", label: "Send DM" },
  { id: "feedback", label: "Feedback cards" },
  { id: "welcome", label: "Welcome messages" },
  { id: "rules", label: "Welcome rules" },
  { id: "profiles", label: "Custom profiles" },
  { id: "media", label: "Media upload" },
  { id: "inbox", label: "Inbox / events" },
  { id: "lookup", label: "User lookup" },
];

export function App() {
  const [section, setSection] = useState<Section>("feedback");
  const [status, setStatus] = useState<Status | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [result, setResult] = useState<ProxyResult | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("dm-test-recipient");
    if (saved) setRecipientId(saved);
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error");
    if (authError) {
      setResult({ error: `Sign-in failed: ${authError}` });
      window.history.replaceState({}, "", window.location.pathname);
    }
    void fetch("/api/status")
      .then((response) => response.json())
      .then(setStatus);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dm-test-recipient", recipientId);
  }, [recipientId]);

  const signedIn = Boolean(status?.user);

  async function run(request: ProxyRequest) {
    if (!signedIn) {
      const failed = { error: "Sign in with X first." };
      setResult(failed);
      return failed;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const json = await response.json();
      setResult(json);
      return json;
    } catch (error) {
      const failed = { error: error instanceof Error ? error.message : "Request failed" };
      setResult(failed);
      return failed;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>DM Test Bench</h1>
          <p>Legacy v1.1 Direct Messages</p>
        </div>
        <nav className="nav">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "active" : ""}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{SECTIONS.find((item) => item.id === section)?.label}</h2>
            <p>
              Builds real v1.1 requests so you can drop CSAT/NPS cards, quick replies, welcome
              messages, media, and the rest into a conversation and inspect the raw response.
            </p>
          </div>
          <Identity status={status} />
        </div>

        <div className="recipient">
          <Field label="Recipient user ID">
            <input
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value.trim())}
              placeholder="1234567890"
            />
          </Field>
          <div style={{ alignSelf: "end" }}>
            <Button kind="ghost" onClick={() => setSection("lookup")}>
              Look up a handle
            </Button>
          </div>
        </div>

        {section === "overview" && <Overview />}
        {section === "send" && (
          <SendSection recipientId={recipientId} busy={busy || !signedIn} onRun={run} />
        )}
        {section === "feedback" && (
          <FeedbackSection recipientId={recipientId} busy={busy || !signedIn} onRun={run} />
        )}
        {section === "welcome" && <WelcomeSection busy={busy || !signedIn} onRun={run} />}
        {section === "rules" && <RulesSection busy={busy || !signedIn} onRun={run} />}
        {section === "profiles" && <ProfilesSection busy={busy || !signedIn} onRun={run} />}
        {section === "media" && (
          <MediaSection setResult={setResult} setBusy={setBusy} busy={busy || !signedIn} />
        )}
        {section === "inbox" && (
          <InboxSection recipientId={recipientId} busy={busy || !signedIn} onRun={run} />
        )}
        {section === "lookup" && (
          <LookupSection
            onResolved={setRecipientId}
            busy={busy}
            onRun={run}
          />
        )}
      </main>

      <aside className="inspector">
        <Inspector result={result} />
      </aside>
    </div>
  );
}

function Identity({ status }: { status: Status | null }) {
  if (!status) return <div className="identity">Checking sign-in…</div>;
  if (!status.configured) {
    return (
      <div className="identity">
        <div>
          <div className="who">OAuth app not configured</div>
          <div className="meta">Set X_API_KEY and X_API_SECRET</div>
        </div>
        <span className="pill bad">offline</span>
      </div>
    );
  }
  if (!status.user) {
    return (
      <div className="identity">
        <div>
          <div className="who">Not signed in</div>
          <div className="meta">DMs send as the account you authorize</div>
        </div>
        <a className="btn primary" href="/api/auth/login">
          Sign in with X
        </a>
      </div>
    );
  }
  return (
    <div className="identity">
      {status.user.avatar ? <img src={status.user.avatar} alt="" /> : null}
      <div>
        <div className="who">@{status.user.screenName}</div>
        <div className="meta">{status.user.id}</div>
      </div>
      <span className="pill ok">sending as</span>
      <Button
        kind="ghost"
        onClick={() => {
          void fetch("/api/auth/logout", { method: "POST" }).then(() => {
            window.location.reload();
          });
        }}
      >
        Sign out
      </Button>
    </div>
  );
}

function Inspector({ result }: { result: ProxyResult | { error: string } | null }) {
  if (!result) {
    return (
      <>
        <h3>Inspector</h3>
        <p className="hint">Run any action to see the signed request URL and API response here.</p>
      </>
    );
  }
  if ("error" in result && !("status" in result)) {
    return (
      <>
        <h3>Inspector</h3>
        <pre>{result.error}</pre>
      </>
    );
  }
  const proxy = result as ProxyResult;
  return (
    <>
      <h3>Request</h3>
      <div className="status-line">
        <span>
          {proxy.method} {proxy.status ? `→ ${proxy.status}` : ""}
        </span>
        <span>{proxy.ms}ms</span>
      </div>
      <pre>{proxy.url}</pre>
      {proxy.requestBody ? <pre>{JSON.stringify(proxy.requestBody, null, 2)}</pre> : null}
      <h3>Response</h3>
      <pre>{JSON.stringify(proxy.body, null, 2)}</pre>
    </>
  );
}

function Overview() {
  return (
    <div className="grid">
      <Card title="What this covers" hint="All of the legacy v1.1 DM surfaces used for customer-service / partner testing.">
        <ul>
          <li>
            <code>POST /1.1/feedback/create.json</code> — NPS and CSAT cards, every question variant
          </li>
          <li>Feedback show / events / submit / dismiss</li>
          <li>
            <code>POST /1.1/direct_messages/events/new.json</code> — text, URL previews, media, quick
            replies, CTAs, location, custom profile
          </li>
          <li>Event list / show / destroy, mark read, typing indicator</li>
          <li>Welcome messages and welcome-message rules</li>
          <li>Custom profiles</li>
          <li>DM media upload (image / GIF / video)</li>
        </ul>
      </Card>
      <Card title="How to use it">
        <ol>
          <li>Set <code>X_API_KEY</code> and <code>X_API_SECRET</code> (OAuth 1.0a consumer keys).</li>
          <li>Add callback URL <code>https://&lt;host&gt;/api/auth/callback</code> (and localhost for local).</li>
          <li>Sign in with X — v1.1 requests are signed as that account.</li>
          <li>Put the recipient’s numeric user ID in the bar above (or look up a handle).</li>
          <li>Send a CSAT card as the control, then an NPS card to reproduce the XChat fallback.</li>
        </ol>
      </Card>
    </div>
  );
}

function MessageComposer({
  draft,
  setDraft,
}: {
  draft: MessageDraft;
  setDraft: (draft: MessageDraft) => void;
}) {
  function patch(next: Partial<MessageDraft>) {
    setDraft({ ...draft, ...next });
  }

  return (
    <div className="fields">
      <Field label="Text">
        <textarea
          value={draft.text}
          onChange={(event) => patch({ text: event.target.value })}
          placeholder="Message text. URLs here become web previews."
        />
      </Field>
      <div className="grid two">
        <Field label="Attachment">
          <select
            value={draft.attachmentKind}
            onChange={(event) =>
              patch({ attachmentKind: event.target.value as MessageDraft["attachmentKind"] })
            }
          >
            <option value="none">None</option>
            <option value="media">Media (image / GIF / video id)</option>
            <option value="location_coord">Location coordinates</option>
            <option value="location_place">Location place id</option>
          </select>
        </Field>
        <Field label="Custom profile ID">
          <input
            value={draft.customProfileId}
            onChange={(event) => patch({ customProfileId: event.target.value })}
            placeholder="optional"
          />
        </Field>
      </div>
      {draft.attachmentKind === "media" && (
        <Field label="Media ID">
          <input
            value={draft.mediaId}
            onChange={(event) => patch({ mediaId: event.target.value })}
            placeholder="from Media upload"
          />
        </Field>
      )}
      {draft.attachmentKind === "location_coord" && (
        <div className="grid two">
          <Field label="Latitude">
            <input
              value={draft.latitude}
              onChange={(event) => patch({ latitude: event.target.value })}
            />
          </Field>
          <Field label="Longitude">
            <input
              value={draft.longitude}
              onChange={(event) => patch({ longitude: event.target.value })}
            />
          </Field>
        </div>
      )}
      {draft.attachmentKind === "location_place" && (
        <Field label="Place ID">
          <input
            value={draft.placeId}
            onChange={(event) => patch({ placeId: event.target.value })}
          />
        </Field>
      )}

      <div>
        <div className="row" style={{ marginBottom: 8 }}>
          <strong>Quick replies</strong>
          <Button
            kind="ghost"
            onClick={() =>
              patch({
                quickReplies: [
                  ...draft.quickReplies,
                  { label: "", description: "", metadata: "" },
                ].slice(0, 20),
              })
            }
          >
            Add option
          </Button>
        </div>
        <div className="list">
          {draft.quickReplies.map((option, index) => (
            <div className="item" key={index}>
              <div className="grid two">
                <input
                  placeholder="Label"
                  value={option.label}
                  onChange={(event) => {
                    const quickReplies = draft.quickReplies.slice();
                    quickReplies[index] = { ...option, label: event.target.value };
                    patch({ quickReplies });
                  }}
                />
                <input
                  placeholder="Description"
                  value={option.description}
                  onChange={(event) => {
                    const quickReplies = draft.quickReplies.slice();
                    quickReplies[index] = { ...option, description: event.target.value };
                    patch({ quickReplies });
                  }}
                />
                <input
                  placeholder="Metadata"
                  value={option.metadata}
                  onChange={(event) => {
                    const quickReplies = draft.quickReplies.slice();
                    quickReplies[index] = { ...option, metadata: event.target.value };
                    patch({ quickReplies });
                  }}
                />
              </div>
              <Button
                kind="ghost"
                onClick={() =>
                  patch({ quickReplies: draft.quickReplies.filter((_, i) => i !== index) })
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="row" style={{ marginBottom: 8 }}>
          <strong>Buttons (CTAs)</strong>
          <Button
            kind="ghost"
            onClick={() => patch({ ctas: [...draft.ctas, { label: "", url: "" }] })}
          >
            Add button
          </Button>
        </div>
        <div className="list">
          {draft.ctas.map((cta, index) => (
            <div className="item" key={index}>
              <div className="grid two">
                <input
                  placeholder="Label"
                  value={cta.label}
                  onChange={(event) => {
                    const ctas = draft.ctas.slice();
                    ctas[index] = { ...cta, label: event.target.value };
                    patch({ ctas });
                  }}
                />
                <input
                  placeholder="https://"
                  value={cta.url}
                  onChange={(event) => {
                    const ctas = draft.ctas.slice();
                    ctas[index] = { ...cta, url: event.target.value };
                    patch({ ctas });
                  }}
                />
              </div>
              <Button
                kind="ghost"
                onClick={() => patch({ ctas: draft.ctas.filter((_, i) => i !== index) })}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function applyPreset(name: string): MessageDraft {
  const base = emptyDraft();
  const replies = (...labels: string[]): QuickReplyOption[] =>
    labels.map((label, index) => ({
      label,
      description: "",
      metadata: `option_${index + 1}`,
    }));
  const buttons = (...pairs: [string, string][]): Cta[] =>
    pairs.map(([label, url]) => ({ label, url }));

  switch (name) {
    case "text":
      return { ...base, text: "Hello from DM Test Bench" };
    case "url":
      return { ...base, text: "Web preview test: https://x.com" };
    case "media":
      return { ...base, text: "Image attachment", attachmentKind: "media" };
    case "qr3":
      return {
        ...base,
        text: "Pick a color",
        quickReplies: replies("Red", "Green", "Blue"),
      };
    case "qr20":
      return {
        ...base,
        text: "Pick a number",
        quickReplies: replies(...Array.from({ length: 20 }, (_, i) => String(i + 1))),
      };
    case "cta":
      return {
        ...base,
        text: "Useful links",
        ctas: buttons(["Open X", "https://x.com"], ["Help", "https://help.x.com"]),
      };
    case "qr+cta":
      return {
        ...base,
        text: "Need anything else?",
        quickReplies: replies("Yes", "No"),
        ctas: buttons(["Visit site", "https://x.com"]),
      };
    case "media+qr":
      return {
        ...base,
        text: "What do you think?",
        attachmentKind: "media",
        quickReplies: replies("Love it", "Not for me"),
      };
    case "location":
      return {
        ...base,
        text: "Meet here",
        attachmentKind: "location_coord",
        latitude: "37.7764",
        longitude: "-122.417",
      };
    default:
      return base;
  }
}

function SendSection({
  recipientId,
  busy,
  onRun,
}: {
  recipientId: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MessageDraft>(applyPreset("text"));

  function send() {
    const messageCreate: Record<string, unknown> = {
      target: { recipient_id: recipientId },
      message_data: buildMessageData(draft),
    };
    if (draft.customProfileId.trim()) {
      messageCreate.custom_profile_id = draft.customProfileId.trim();
    }
    void onRun({
      method: "POST",
      path: "/1.1/direct_messages/events/new.json",
      bodyType: "json",
      body: {
        event: {
          type: "message_create",
          message_create: messageCreate,
        },
      },
    });
  }

  return (
    <div className="grid">
      <Card title="Presets" hint="Fills the composer. Media presets still need a media id from the Media tab.">
        <div className="row">
          {[
            ["text", "Plain text"],
            ["url", "URL preview"],
            ["media", "Image / media"],
            ["qr3", "Quick replies (3)"],
            ["qr20", "Quick replies (20)"],
            ["cta", "Buttons"],
            ["qr+cta", "QR + buttons"],
            ["media+qr", "Media + QR"],
            ["location", "Location pin"],
          ].map(([id, label]) => (
            <Button key={id} onClick={() => setDraft(applyPreset(id))}>
              {label}
            </Button>
          ))}
        </div>
      </Card>
      <Card title="POST /1.1/direct_messages/events/new.json">
        <MessageComposer draft={draft} setDraft={setDraft} />
        <div className="actions">
          <Button kind="primary" disabled={busy || !recipientId} onClick={send}>
            Send DM
          </Button>
        </div>
      </Card>
    </div>
  );
}

function FeedbackSection({
  recipientId,
  busy,
  onRun,
}: {
  recipientId: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<void>;
}) {
  const [type, setType] = useState<"nps" | "csat">("nps");
  const [message, setMessage] = useState("Sending Customer Feedback survey");
  const [privacyUrl, setPrivacyUrl] = useState("https://x.com/privacy");
  const [displayName, setDisplayName] = useState("Test Bench");
  const [externalId, setExternalId] = useState("");
  const [variantId, setVariantId] = useState(0);
  const [test, setTest] = useState(true);
  const [feedbackId, setFeedbackId] = useState("");
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [fromTime, setFromTime] = useState(() => String(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [toTime, setToTime] = useState(() => String(Date.now()));
  const [cursor, setCursor] = useState("");

  const variants = type === "nps" ? NPS_VARIANTS : CSAT_VARIANTS;
  const preview = useMemo(
    () => questionText(type, variantId, displayName),
    [type, variantId, displayName],
  );

  function create() {
    void onRun({
      method: "POST",
      path: "/1.1/feedback/create.json",
      bodyType: "form",
      body: {
        type,
        to_user_id: recipientId,
        message,
        privacy_url: privacyUrl,
        display_name: displayName,
        external_id: externalId,
        question_variant_id: String(variantId),
        test: test ? "true" : "false",
      },
    });
  }

  return (
    <div className="grid">
      <Card
        title="POST /1.1/feedback/create.json"
        hint="NPS is the broken XChat path. CSAT is the working control. test=true keeps it out of analytics."
      >
        <div className="fields">
          <div className="grid two">
            <Field label="Type">
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value as "nps" | "csat");
                  setVariantId(0);
                }}
              >
                <option value="nps">nps</option>
                <option value="csat">csat</option>
              </select>
            </Field>
            <Field label="Question variant">
              <select
                value={variantId}
                onChange={(event) => setVariantId(Number(event.target.value))}
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.id} — {variant.text.replace("<displayName>", displayName || "…")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="DM message">
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
          </Field>
          <div className="grid two">
            <Field label="Display name">
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </Field>
            <Field label="Privacy URL">
              <input value={privacyUrl} onChange={(event) => setPrivacyUrl(event.target.value)} />
            </Field>
            <Field label="External ID">
              <input value={externalId} onChange={(event) => setExternalId(event.target.value)} />
            </Field>
            <Field label="Test flag">
              <select value={test ? "true" : "false"} onChange={(event) => setTest(event.target.value === "true")}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </Field>
          </div>
          <div className="preview">Card question: {preview}</div>
        </div>
        <div className="actions">
          <Button kind="primary" disabled={busy || !recipientId} onClick={create}>
            Create {type.toUpperCase()} card
          </Button>
          <Button
            disabled={busy || !recipientId}
            onClick={() => {
              setType("csat");
              setVariantId(0);
              setMessage("Sending CSAT control survey");
            }}
          >
            Fill CSAT control
          </Button>
          <Button
            disabled={busy || !recipientId}
            onClick={() => {
              setType("nps");
              setVariantId(0);
              setMessage("Sending Customer Feedback survey");
            }}
          >
            Fill NPS repro
          </Button>
        </div>
      </Card>

      <div className="grid two">
        <Card title="GET /1.1/feedback/show/:id.json">
          <div className="fields">
            <Field label="Feedback ID">
              <input value={feedbackId} onChange={(event) => setFeedbackId(event.target.value)} />
            </Field>
          </div>
          <div className="actions">
            <Button
              disabled={busy || !feedbackId}
              onClick={() =>
                void onRun({
                  method: "GET",
                  path: `/1.1/feedback/show/${feedbackId}.json`,
                })
              }
            >
              Show
            </Button>
          </div>
        </Card>

        <Card title="POST /1.1/feedback/submit/:id.json" hint="Must be called as the recipient. NPS score 0–10, CSAT 1–5.">
          <div className="fields">
            <Field label="Feedback ID">
              <input value={feedbackId} onChange={(event) => setFeedbackId(event.target.value)} />
            </Field>
            <div className="grid two">
              <Field label="Score">
                <input value={score} onChange={(event) => setScore(event.target.value)} />
              </Field>
              <Field label="Text">
                <input value={comment} onChange={(event) => setComment(event.target.value)} />
              </Field>
            </div>
          </div>
          <div className="actions">
            <Button
              disabled={busy || !feedbackId}
              onClick={() =>
                void onRun({
                  method: "POST",
                  path: `/1.1/feedback/submit/${feedbackId}.json`,
                  bodyType: "form",
                  body: { score, text: comment },
                })
              }
            >
              Submit
            </Button>
            <Button
              disabled={busy || !feedbackId}
              onClick={() =>
                void onRun({
                  method: "POST",
                  path: `/1.1/feedback/dismiss/${feedbackId}.json`,
                })
              }
            >
              Dismiss
            </Button>
          </div>
        </Card>
      </div>

      <Card title="GET /1.1/feedback/events.json" hint="First page needs from_time + to_time in milliseconds. Later pages use cursor only.">
        <div className="grid two">
          <Field label="from_time (ms)">
            <input value={fromTime} onChange={(event) => setFromTime(event.target.value)} />
          </Field>
          <Field label="to_time (ms)">
            <input value={toTime} onChange={(event) => setToTime(event.target.value)} />
          </Field>
          <Field label="cursor">
            <input value={cursor} onChange={(event) => setCursor(event.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() =>
              void onRun({
                method: "GET",
                path: "/1.1/feedback/events.json",
                query: cursor
                  ? { cursor, count: "50" }
                  : { from_time: fromTime, to_time: toTime, count: "50" },
              })
            }
          >
            List events
          </Button>
        </div>
      </Card>
    </div>
  );
}

function WelcomeSection({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<void>;
}) {
  const [name, setName] = useState("dm-test welcome");
  const [welcomeId, setWelcomeId] = useState("");
  const [cursor, setCursor] = useState("");
  const [draft, setDraft] = useState<MessageDraft>({
    ...emptyDraft(),
    text: "Welcome! How can we help?",
  });

  return (
    <div className="grid">
      <Card title="POST /1.1/direct_messages/welcome_messages/new.json">
        <div className="fields">
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <MessageComposer draft={draft} setDraft={setDraft} />
        </div>
        <div className="actions">
          <Button
            kind="primary"
            disabled={busy}
            onClick={() =>
              void onRun({
                method: "POST",
                path: "/1.1/direct_messages/welcome_messages/new.json",
                bodyType: "json",
                body: {
                  welcome_message: {
                    name,
                    message_data: buildMessageData(draft),
                  },
                },
              })
            }
          >
            Create welcome message
          </Button>
        </div>
      </Card>
      <div className="grid two">
        <Card title="GET show / PUT update / DELETE destroy">
          <Field label="Welcome message ID">
            <input value={welcomeId} onChange={(event) => setWelcomeId(event.target.value)} />
          </Field>
          <div className="actions">
            <Button
              disabled={busy || !welcomeId}
              onClick={() =>
                void onRun({
                  method: "GET",
                  path: "/1.1/direct_messages/welcome_messages/show.json",
                  query: { id: welcomeId },
                })
              }
            >
              Show
            </Button>
            <Button
              disabled={busy || !welcomeId}
              onClick={() =>
                void onRun({
                  method: "PUT",
                  path: "/1.1/direct_messages/welcome_messages/update.json",
                  query: { id: welcomeId },
                  bodyType: "json",
                  body: { message_data: buildMessageData(draft) },
                })
              }
            >
              Update from composer
            </Button>
            <Button
              disabled={busy || !welcomeId}
              onClick={() =>
                void onRun({
                  method: "DELETE",
                  path: "/1.1/direct_messages/welcome_messages/destroy.json",
                  query: { id: welcomeId },
                })
              }
            >
              Destroy
            </Button>
          </div>
        </Card>
        <Card title="GET /1.1/direct_messages/welcome_messages/list.json">
          <Field label="cursor">
            <input value={cursor} onChange={(event) => setCursor(event.target.value)} />
          </Field>
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() =>
                void onRun({
                  method: "GET",
                  path: "/1.1/direct_messages/welcome_messages/list.json",
                  query: { count: "20", cursor },
                })
              }
            >
              List
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RulesSection({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<void>;
}) {
  const [welcomeMessageId, setWelcomeMessageId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [cursor, setCursor] = useState("");

  return (
    <div className="grid two">
      <Card
        title="POST /1.1/direct_messages/welcome_messages/rules/new.json"
        hint="Most recently created rule becomes the default welcome message."
      >
        <Field label="Welcome message ID">
          <input
            value={welcomeMessageId}
            onChange={(event) => setWelcomeMessageId(event.target.value)}
          />
        </Field>
        <div className="actions">
          <Button
            kind="primary"
            disabled={busy || !welcomeMessageId}
            onClick={() =>
              void onRun({
                method: "POST",
                path: "/1.1/direct_messages/welcome_messages/rules/new.json",
                bodyType: "json",
                body: { welcome_message_rule: { welcome_message_id: welcomeMessageId } },
              })
            }
          >
            Create rule
          </Button>
        </div>
      </Card>
      <Card title="Show / list / destroy">
        <Field label="Rule ID">
          <input value={ruleId} onChange={(event) => setRuleId(event.target.value)} />
        </Field>
        <Field label="cursor">
          <input value={cursor} onChange={(event) => setCursor(event.target.value)} />
        </Field>
        <div className="actions">
          <Button
            disabled={busy || !ruleId}
            onClick={() =>
              void onRun({
                method: "GET",
                path: "/1.1/direct_messages/welcome_messages/rules/show.json",
                query: { id: ruleId },
              })
            }
          >
            Show
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void onRun({
                method: "GET",
                path: "/1.1/direct_messages/welcome_messages/rules/list.json",
                query: { count: "20", cursor },
              })
            }
          >
            List
          </Button>
          <Button
            disabled={busy || !ruleId}
            onClick={() =>
              void onRun({
                method: "DELETE",
                path: "/1.1/direct_messages/welcome_messages/rules/destroy.json",
                query: { id: ruleId },
              })
            }
          >
            Destroy
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ProfilesSection({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<void>;
}) {
  const [name, setName] = useState("Support Agent");
  const [mediaId, setMediaId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [cursor, setCursor] = useState("");

  return (
    <div className="grid two">
      <Card
        title="POST /1.1/custom_profiles/new.json"
        hint="Account must be allowlisted for custom profiles. Upload an avatar on the Media tab first."
      >
        <div className="fields">
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Avatar media ID">
            <input value={mediaId} onChange={(event) => setMediaId(event.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <Button
            kind="primary"
            disabled={busy || !name || !mediaId}
            onClick={() =>
              void onRun({
                method: "POST",
                path: "/1.1/custom_profiles/new.json",
                bodyType: "json",
                body: {
                  custom_profile: {
                    name,
                    avatar: { type: "media", media: { id: mediaId } },
                  },
                },
              })
            }
          >
            Create profile
          </Button>
        </div>
      </Card>
      <Card title="GET /:id · list · destroy">
        <Field label="Custom profile ID">
          <input value={profileId} onChange={(event) => setProfileId(event.target.value)} />
        </Field>
        <Field label="cursor">
          <input value={cursor} onChange={(event) => setCursor(event.target.value)} />
        </Field>
        <div className="actions">
          <Button
            disabled={busy || !profileId}
            onClick={() =>
              void onRun({
                method: "GET",
                path: `/1.1/custom_profiles/${profileId}.json`,
              })
            }
          >
            Show
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void onRun({
                method: "GET",
                path: "/1.1/custom_profiles/list.json",
                query: { count: "20", cursor },
              })
            }
          >
            List
          </Button>
          <Button
            disabled={busy || !profileId}
            onClick={() =>
              void onRun({
                method: "DELETE",
                path: "/1.1/custom_profiles/destroy.json",
                query: { id: profileId },
              })
            }
          >
            Destroy
          </Button>
        </div>
      </Card>
    </div>
  );
}

function MediaSection({
  busy,
  setBusy,
  setResult,
}: {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setResult: (result: ProxyResult | { error: string }) => void;
}) {
  const [category, setCategory] = useState<"dm_image" | "dm_gif" | "dm_video">("dm_image");
  const [file, setFile] = useState<File | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("media_category", category);
      const response = await fetch("/api/media", { method: "POST", body: form });
      setResult(await response.json());
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="POST upload.twitter.com/1.1/media/upload.json"
      hint="Images use simple upload. Videos and large files use INIT/APPEND/FINALIZE. Copy media_id_string into Send DM or Feedback-adjacent attachments."
    >
      <div className="fields">
        <Field label="Category">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
          >
            <option value="dm_image">dm_image</option>
            <option value="dm_gif">dm_gif</option>
            <option value="dm_video">dm_video</option>
          </select>
        </Field>
        <Field label="File">
          <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
      </div>
      <div className="actions">
        <Button kind="primary" disabled={busy || !file} onClick={() => void upload()}>
          Upload
        </Button>
      </div>
    </Card>
  );
}

function InboxSection({
  recipientId,
  busy,
  onRun,
}: {
  recipientId: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<void>;
}) {
  const [eventId, setEventId] = useState("");
  const [cursor, setCursor] = useState("");

  return (
    <div className="grid two">
      <Card title="GET /1.1/direct_messages/events/list.json">
        <Field label="cursor">
          <input value={cursor} onChange={(event) => setCursor(event.target.value)} />
        </Field>
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() =>
              void onRun({
                method: "GET",
                path: "/1.1/direct_messages/events/list.json",
                query: { count: "50", cursor },
              })
            }
          >
            List events
          </Button>
        </div>
      </Card>
      <Card title="Show / destroy event">
        <Field label="Event ID">
          <input value={eventId} onChange={(event) => setEventId(event.target.value)} />
        </Field>
        <div className="actions">
          <Button
            disabled={busy || !eventId}
            onClick={() =>
              void onRun({
                method: "GET",
                path: "/1.1/direct_messages/events/show.json",
                query: { id: eventId },
              })
            }
          >
            Show
          </Button>
          <Button
            disabled={busy || !eventId}
            onClick={() =>
              void onRun({
                method: "DELETE",
                path: "/1.1/direct_messages/events/destroy.json",
                query: { id: eventId },
              })
            }
          >
            Destroy
          </Button>
        </div>
      </Card>
      <Card title="POST /1.1/direct_messages/mark_read.json">
        <div className="actions">
          <Button
            disabled={busy || !recipientId || !eventId}
            onClick={() =>
              void onRun({
                method: "POST",
                path: "/1.1/direct_messages/mark_read.json",
                bodyType: "form",
                body: { last_read_event_id: eventId, recipient_id: recipientId },
              })
            }
          >
            Mark read
          </Button>
        </div>
      </Card>
      <Card title="POST /1.1/direct_messages/indicate_typing.json">
        <div className="actions">
          <Button
            disabled={busy || !recipientId}
            onClick={() =>
              void onRun({
                method: "POST",
                path: "/1.1/direct_messages/indicate_typing.json",
                bodyType: "form",
                body: { recipient_id: recipientId },
              })
            }
          >
            Send typing indicator
          </Button>
        </div>
      </Card>
    </div>
  );
}

function LookupSection({
  onResolved,
  busy,
  onRun,
}: {
  onResolved: (id: string) => void;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
}) {
  const [handle, setHandle] = useState("");

  async function lookup() {
    const screenName = handle.replace(/^@/, "");
    const json = (await onRun({
      method: "GET",
      path: "/1.1/users/show.json",
      query: { screen_name: screenName },
    })) as { body?: { id_str?: string } };
    if (typeof json?.body?.id_str === "string") onResolved(json.body.id_str);
  }

  return (
    <Card title="GET /1.1/users/show.json" hint="Resolves a handle to a numeric user ID and stores it as the recipient.">
      <Field label="Handle">
        <input
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="jack"
        />
      </Field>
      <div className="actions">
        <Button kind="primary" disabled={busy || !handle} onClick={() => void lookup()}>
          Resolve
        </Button>
      </div>
    </Card>
  );
}
