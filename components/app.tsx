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
import { Button, Card, Field, Icon, Method } from "./ui";

type Section = "conversation" | "assets" | "inspect" | "endpoints";

type SendKind = "message" | "nps" | "csat";

type Status = {
  configured: boolean;
  signedIn?: boolean;
  user: { id?: string; screenName?: string; name?: string; avatar?: string } | null;
  error?: unknown;
};

type NavIcon = "chat" | "box" | "search" | "list";

const NAV: { id: Section; label: string; hint: string; icon: NavIcon }[] = [
  { id: "conversation", label: "Conversation", hint: "Send a message or survey to a person", icon: "chat" },
  { id: "assets", label: "Assets", hint: "Media, custom profiles, welcome messages", icon: "box" },
  { id: "inspect", label: "Inspect", hint: "Look up users, feedback, and inbox events", icon: "search" },
  { id: "endpoints", label: "All endpoints", hint: "Every field on every route", icon: "list" },
];

export function App() {
  const [section, setSection] = useState<Section>("conversation");
  const [status, setStatus] = useState<Status | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [recipientHandle, setRecipientHandle] = useState("");
  const [lastMediaId, setLastMediaId] = useState("");
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
          <div className="brand-mark">
            <Icon name="chat" />
          </div>
          <div>
            <h1>DM Test Bench</h1>
            <p>Legacy v1.1 Direct Messages</p>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-label">Workflow</div>
          {NAV.slice(0, 3).map((item) => (
            <NavButton key={item.id} item={item} active={section === item.id} onSelect={setSection} />
          ))}
          <div className="nav-label">Reference</div>
          {NAV.slice(3).map((item) => (
            <NavButton key={item.id} item={item} active={section === item.id} onSelect={setSection} />
          ))}
        </nav>
        <div className="sidebar-foot">
          Requests are signed server-side with OAuth 1.0a as the signed-in account.
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{NAV.find((item) => item.id === section)?.label}</h2>
            <p>{NAV.find((item) => item.id === section)?.hint}</p>
          </div>
          <Identity status={status} />
        </div>

        {section === "conversation" && (
          <ConversationPage
            status={status}
            recipientId={recipientId}
            setRecipientId={setRecipientId}
            recipientHandle={recipientHandle}
            setRecipientHandle={setRecipientHandle}
            lastMediaId={lastMediaId}
            busy={busy || !signedIn}
            onRun={run}
          />
        )}
        {section === "assets" && (
          <AssetsPage
            busy={busy || !signedIn}
            onRun={run}
            setResult={setResult}
            setBusy={setBusy}
            onMediaId={setLastMediaId}
          />
        )}
        {section === "inspect" && (
          <InspectPage
            recipientId={recipientId}
            setRecipientId={setRecipientId}
            busy={busy || !signedIn}
            onRun={run}
          />
        )}
        {section === "endpoints" && (
          <EndpointsPage
            recipientId={recipientId}
            busy={busy || !signedIn}
            onRun={run}
            setResult={setResult}
            setBusy={setBusy}
          />
        )}
      </main>

      <aside className="inspector">
        <Inspector result={result} busy={busy} />
      </aside>
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onSelect: (section: Section) => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={() => onSelect(item.id)}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </button>
  );
}

function Identity({ status }: { status: Status | null }) {
  if (!status) {
    return (
      <div className="identity plain">
        <span className="dot" />
        <span className="hint">Checking sign-in…</span>
      </div>
    );
  }
  if (!status.configured) {
    return (
      <div className="identity">
        <span className="dot bad" />
        <div>
          <div className="who">OAuth app not configured</div>
          <div className="meta">X_API_KEY · X_API_SECRET</div>
        </div>
      </div>
    );
  }
  if (!status.user) {
    return (
      <div className="identity plain">
        <a className="btn primary" href="/api/auth/login">
          Sign in with X
        </a>
      </div>
    );
  }
  return (
    <div className="identity" title={`Sending as @${status.user.screenName}`}>
      {status.user.avatar ? (
        <img src={status.user.avatar} alt="" />
      ) : (
        <span className="avatar-fallback" />
      )}
      <div>
        <div className="who">@{status.user.screenName}</div>
        <div className="meta">{status.user.id}</div>
      </div>
      <span className="dot ok" />
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

function statusTone(status: number): "ok" | "warn" | "bad" | "" {
  if (!status) return "";
  if (status < 300) return "ok";
  if (status < 500) return "warn";
  return "bad";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      kind="ghost"
      size="sm"
      title="Copy to clipboard"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function JsonBlock({ label, value, error }: { label: string; value: unknown; error?: boolean }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="block">
      <div className="block-head">
        <span>{label}</span>
        <CopyButton text={text ?? ""} />
      </div>
      <pre className={error ? (typeof value === "string" ? "error plain" : "error") : ""}>{text}</pre>
    </div>
  );
}

function Inspector({ result, busy }: { result: ProxyResult | { error: string } | null; busy: boolean }) {
  if (!result) {
    return (
      <>
        <div className="inspector-head">
          <h3>Inspector</h3>
        </div>
        <div className="inspector-body">
          <div className="inspector-empty">
            <Icon name="pulse" />
            <div>
              Run any action and the signed request URL, body, and raw API response show up here.
            </div>
          </div>
        </div>
      </>
    );
  }
  if ("error" in result && !("status" in result)) {
    return (
      <>
        <div className="inspector-head">
          <h3>Inspector</h3>
          {busy ? <span className="pill">working…</span> : null}
        </div>
        <div className="inspector-body">
          <JsonBlock label="Error" value={result.error} error />
        </div>
      </>
    );
  }
  const proxy = result as ProxyResult;
  const url = (() => {
    try {
      const parsed = new URL(proxy.url);
      return { host: parsed.host, path: parsed.pathname + parsed.search };
    } catch {
      return { host: "", path: proxy.url };
    }
  })();
  const tone = statusTone(proxy.status);
  return (
    <>
      <div className="inspector-head">
        <h3>Inspector</h3>
        {busy ? <span className="pill">working…</span> : null}
      </div>
      <div className="inspector-body">
        <div className="block">
          <div className="status-row">
            <Method verb={proxy.method as "GET" | "POST" | "PUT" | "DELETE"} />
            <span className={`status-code ${tone}`}>{proxy.status || "—"}</span>
            <span />
            <span className="ms">{proxy.ms} ms</span>
          </div>
          <div className="url-line">
            {url.host ? <span>{url.host}</span> : null}
            <span className="path">{url.path}</span>
          </div>
        </div>
        {proxy.requestBody ? <JsonBlock label="Request body" value={proxy.requestBody} /> : null}
        <JsonBlock label="Response" value={proxy.body} error={tone === "bad" || tone === "warn"} />
      </div>
    </>
  );
}

function ConversationPage({
  status,
  recipientId,
  setRecipientId,
  recipientHandle,
  setRecipientHandle,
  lastMediaId,
  busy,
  onRun,
}: {
  status: Status | null;
  recipientId: string;
  setRecipientId: (id: string) => void;
  recipientHandle: string;
  setRecipientHandle: (handle: string) => void;
  lastMediaId: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
}) {
  const [kind, setKind] = useState<SendKind>("nps");
  const [looking, setLooking] = useState(false);

  async function resolveHandle() {
    const screenName = recipientHandle.replace(/^@/, "").trim();
    if (!screenName) return;
    setLooking(true);
    const json = (await onRun({
      method: "GET",
      path: "/1.1/users/show.json",
      query: { screen_name: screenName },
    })) as { body?: { id_str?: string; screen_name?: string } };
    if (typeof json?.body?.id_str === "string") {
      setRecipientId(json.body.id_str);
      if (json.body.screen_name) setRecipientHandle(json.body.screen_name);
    }
    setLooking(false);
  }

  const toIsNumeric = /^\d+$/.test(recipientHandle || recipientId);

  return (
    <div className="convo">
      <div className="convo-bar">
        <Field label="From">
          <input
            readOnly
            value={status?.user ? `@${status.user.screenName}` : "Sign in first"}
          />
        </Field>
        <div className="convo-arrow">
          <Icon name="arrow" />
        </div>
        <div>
          <Field label="To">
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input
                value={recipientHandle || recipientId}
                onChange={(event) => {
                  const value = event.target.value.trim().replace(/^@/, "");
                  setRecipientHandle(value);
                  if (/^\d+$/.test(value)) setRecipientId(value);
                  else setRecipientId("");
                }}
                placeholder="@handle or user ID"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void resolveHandle();
                }}
              />
              <Button
                disabled={busy || looking || !recipientHandle || toIsNumeric}
                onClick={() => void resolveHandle()}
              >
                {looking ? "Looking up…" : "Look up"}
              </Button>
            </div>
          </Field>
          {recipientId ? (
            <div className="hint">
              Resolved to <code>{recipientId}</code>
            </div>
          ) : (
            <div className="hint">Enter a handle and press Enter to resolve it to a user ID.</div>
          )}
        </div>
      </div>

      <div className="types" role="tablist">
        <button className={kind === "nps" ? "active" : ""} onClick={() => setKind("nps")}>
          NPS survey
        </button>
        <button className={kind === "csat" ? "active" : ""} onClick={() => setKind("csat")}>
          CSAT survey
        </button>
        <button className={kind === "message" ? "active" : ""} onClick={() => setKind("message")}>
          Message
        </button>
      </div>

      {kind === "message" && (
        <SendSection recipientId={recipientId} lastMediaId={lastMediaId} busy={busy} onRun={onRun} />
      )}
      {kind === "nps" && (
        <FeedbackCreate
          recipientId={recipientId}
          busy={busy}
          onRun={onRun}
          defaultType="nps"
          lockType
        />
      )}
      {kind === "csat" && (
        <FeedbackCreate
          recipientId={recipientId}
          busy={busy}
          onRun={onRun}
          defaultType="csat"
          lockType
        />
      )}

      <Card title="In this conversation" hint="Typing indicator and the most recent inbox events for the signed-in account.">
        <div className="row">
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
            Show typing
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void onRun({
                method: "GET",
                path: "/1.1/direct_messages/events/list.json",
                query: { count: "20" },
              })
            }
          >
            Load recent messages
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AssetsPage({
  busy,
  onRun,
  setResult,
  setBusy,
  onMediaId,
}: {
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
  setResult: (result: ProxyResult | { error: string }) => void;
  setBusy: (busy: boolean) => void;
  onMediaId: (id: string) => void;
}) {
  return (
    <div className="grid">
      <MediaSection
        busy={busy}
        setBusy={setBusy}
        setResult={(result) => {
          setResult(result);
          if ("body" in result && result.body && typeof result.body === "object") {
            const mediaId = (result.body as { media_id?: string }).media_id;
            if (mediaId) onMediaId(mediaId);
          }
        }}
      />
      <ProfilesSection busy={busy} onRun={onRun} />
      <WelcomeSection busy={busy} onRun={onRun} />
      <RulesSection busy={busy} onRun={onRun} />
    </div>
  );
}

function InspectPage({
  recipientId,
  setRecipientId,
  busy,
  onRun,
}: {
  recipientId: string;
  setRecipientId: (id: string) => void;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
}) {
  return (
    <div className="grid">
      <LookupSection onResolved={setRecipientId} busy={busy} onRun={onRun} />
      <FeedbackInspect recipientId={recipientId} busy={busy} onRun={onRun} />
      <InboxSection recipientId={recipientId} busy={busy} onRun={onRun} />
    </div>
  );
}

function EndpointsPage({
  recipientId,
  busy,
  onRun,
  setResult,
  setBusy,
}: {
  recipientId: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
  setResult: (result: ProxyResult | { error: string }) => void;
  setBusy: (busy: boolean) => void;
}) {
  return (
    <div className="grid">
      <p className="section-intro">
        Full field coverage for each route. Use Conversation when you just want to send something.
      </p>
      <details className="endpoint" open>
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="POST" />
          <span>Create feedback card</span>
          <code>/1.1/feedback/create.json</code>
        </summary>
        <FeedbackCreate recipientId={recipientId} busy={busy} onRun={onRun} defaultType="nps" />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="GET" />
          <span>Feedback show / events / submit / dismiss</span>
        </summary>
        <FeedbackInspect recipientId={recipientId} busy={busy} onRun={onRun} />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="POST" />
          <span>Send message</span>
          <code>/1.1/direct_messages/events/new.json</code>
        </summary>
        <SendSection recipientId={recipientId} lastMediaId="" busy={busy} onRun={onRun} />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="GET" />
          <span>Inbox events, mark read, typing</span>
        </summary>
        <InboxSection recipientId={recipientId} busy={busy} onRun={onRun} />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="POST" />
          <span>Welcome messages</span>
        </summary>
        <WelcomeSection busy={busy} onRun={onRun} />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="POST" />
          <span>Welcome rules</span>
        </summary>
        <RulesSection busy={busy} onRun={onRun} />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="POST" />
          <span>Custom profiles</span>
        </summary>
        <ProfilesSection busy={busy} onRun={onRun} />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="POST" />
          <span>Media upload</span>
          <code>/2/media/upload</code>
        </summary>
        <MediaSection busy={busy} setBusy={setBusy} setResult={setResult} />
      </details>
      <details className="endpoint">
        <summary>
          <Icon name="chevron" className="chev" />
          <Method verb="GET" />
          <span>User lookup</span>
          <code>/1.1/users/show.json</code>
        </summary>
        <LookupSection onResolved={() => undefined} busy={busy} onRun={onRun} />
      </details>
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
        <div className="subhead">
          <span>
            <strong>Quick replies</strong>
            <span className="count">{draft.quickReplies.length}/20</span>
          </span>
          <Button
            kind="ghost"
            size="sm"
            disabled={draft.quickReplies.length >= 20}
            onClick={() =>
              patch({
                quickReplies: [
                  ...draft.quickReplies,
                  { label: "", description: "", metadata: "" },
                ].slice(0, 20),
              })
            }
          >
            <Icon name="plus" className="ico" /> Add option
          </Button>
        </div>
        <div className="list">
          {draft.quickReplies.length === 0 ? (
            <div className="empty">No quick replies. The message sends as plain text.</div>
          ) : null}
          {draft.quickReplies.map((option, index) => (
            <div className="item" key={index}>
              <div className="grid three">
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
                size="sm"
                title="Remove option"
                onClick={() =>
                  patch({ quickReplies: draft.quickReplies.filter((_, i) => i !== index) })
                }
              >
                <Icon name="x" className="ico" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="subhead">
          <span>
            <strong>Buttons</strong>
            <span className="count">{draft.ctas.length}/3</span>
          </span>
          <Button
            kind="ghost"
            size="sm"
            disabled={draft.ctas.length >= 3}
            onClick={() => patch({ ctas: [...draft.ctas, { label: "", url: "" }] })}
          >
            <Icon name="plus" className="ico" /> Add button
          </Button>
        </div>
        <div className="list">
          {draft.ctas.length === 0 ? (
            <div className="empty">No call-to-action buttons.</div>
          ) : null}
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
                size="sm"
                title="Remove button"
                onClick={() => patch({ ctas: draft.ctas.filter((_, i) => i !== index) })}
              >
                <Icon name="x" className="ico" />
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
  lastMediaId,
  busy,
  onRun,
}: {
  recipientId: string;
  lastMediaId?: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
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
      <Card title="Compose a message" hint="Text, web previews, media, quick replies, buttons, and location on POST direct_messages/events/new.">
        <div className="subhead">
          <strong>Start from</strong>
        </div>
        <div className="starters" style={{ marginBottom: 16 }}>
          {[
            ["text", "Plain text"],
            ["url", "URL preview"],
            ["media", "Media"],
            ["qr3", "Quick replies"],
            ["cta", "Buttons"],
            ["qr+cta", "QR + buttons"],
            ["location", "Location"],
          ].map(([id, label]) => (
            <Button key={id} onClick={() => setDraft(applyPreset(id))}>
              {label}
            </Button>
          ))}
        </div>
        <MessageComposer draft={draft} setDraft={setDraft} />
        {lastMediaId && draft.attachmentKind === "media" && !draft.mediaId ? (
          <div className="actions bare">
            <Button size="sm" onClick={() => setDraft({ ...draft, mediaId: lastMediaId })}>
              Use last upload <code>{lastMediaId}</code>
            </Button>
          </div>
        ) : null}
        <div className="actions">
          <Button kind="primary" disabled={busy || !recipientId} onClick={send}>
            <Icon name="send" className="ico" /> Send message
          </Button>
          {!recipientId ? <span className="hint">Choose a recipient first.</span> : null}
        </div>
      </Card>
    </div>
  );
}

function FeedbackCreate({
  recipientId,
  busy,
  onRun,
  defaultType,
  lockType = false,
}: {
  recipientId: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
  defaultType: "nps" | "csat";
  lockType?: boolean;
}) {
  const [type, setType] = useState<"nps" | "csat">(defaultType);
  const [message, setMessage] = useState(
    defaultType === "csat" ? "Sending CSAT control survey" : "Sending Customer Feedback survey",
  );
  const [privacyUrl, setPrivacyUrl] = useState("https://x.com/privacy");
  const [displayName, setDisplayName] = useState("Test Bench");
  const [externalId, setExternalId] = useState("");
  const [variantId, setVariantId] = useState(0);
  const [test, setTest] = useState(true);

  useEffect(() => {
    setType(defaultType);
    setMessage(
      defaultType === "csat" ? "Sending CSAT control survey" : "Sending Customer Feedback survey",
    );
    setVariantId(0);
  }, [defaultType]);

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
    <Card
      title={type === "nps" ? "Send an NPS survey" : "Send a CSAT survey"}
      hint={
        type === "nps"
          ? "Creates a feedback_nps card and DMs it. In XChat the recipient may see a raw card ID instead of the survey."
          : "Creates a feedback_csat card and DMs it. Renders correctly in XChat; use as the control."
      }
      aside={<span className={`pill ${type === "nps" ? "warn" : "ok"}`}>{type === "nps" ? "bug path" : "control"}</span>}
    >
        <div className="fields">
          <div className={lockType ? "fields" : "grid two"}>
            {lockType ? null : (
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
            )}
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
          <div className="preview">
            Card question · <strong>{preview}</strong>
          </div>
        </div>
        <div className="actions">
          <Button kind="primary" disabled={busy || !recipientId} onClick={create}>
            <Icon name="send" className="ico" /> Send {type.toUpperCase()} survey
          </Button>
          {!recipientId ? <span className="hint">Choose a recipient first.</span> : null}
        </div>
      </Card>
  );
}

function FeedbackInspect({
  recipientId: _recipientId,
  busy,
  onRun,
}: {
  recipientId: string;
  busy: boolean;
  onRun: (request: ProxyRequest) => Promise<unknown>;
}) {
  const [feedbackId, setFeedbackId] = useState("");
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [fromTime, setFromTime] = useState(() => String(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [toTime, setToTime] = useState(() => String(Date.now()));
  const [cursor, setCursor] = useState("");

  return (
    <div className="grid">
      <div className="grid two">
        <Card title="Look up a feedback card">
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

        <Card title="Submit or dismiss as the recipient" hint="Must be called while signed in as the recipient. NPS 0–10, CSAT 1–5.">
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

      <Card title="Feedback events for this sender" hint="First page needs from_time + to_time in milliseconds. Later pages use cursor only.">
        <div className="grid two">
          <Field label="from_time (ms)">
            <input value={fromTime} onChange={(event) => setFromTime(event.target.value)} />
          </Field>
          <Field label="to_time (ms)">
            <input value={toTime} onChange={(event) => setToTime(event.target.value)} />
          </Field>
          <Field label="Cursor">
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
  onRun: (request: ProxyRequest) => Promise<unknown>;
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
      <Card title="Welcome message" hint="Shown when someone opens a new DM with this account.">
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
        <Card title="Update or delete a welcome message">
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
            kind="danger"
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
        <Card title="List welcome messages">
          <Field label="Cursor">
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
  onRun: (request: ProxyRequest) => Promise<unknown>;
}) {
  const [welcomeMessageId, setWelcomeMessageId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [cursor, setCursor] = useState("");

  return (
    <div className="grid two">
      <Card
        title="Set default welcome"
        hint="The newest rule is the one people see when they open a new conversation."
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
      <Card title="Manage welcome rules">
        <Field label="Rule ID">
          <input value={ruleId} onChange={(event) => setRuleId(event.target.value)} />
        </Field>
        <Field label="Cursor">
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
            kind="danger"
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
  onRun: (request: ProxyRequest) => Promise<unknown>;
}) {
  const [name, setName] = useState("Support Agent");
  const [mediaId, setMediaId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [cursor, setCursor] = useState("");

  return (
    <div className="grid two">
      <Card
        title="Custom profile"
        hint="Needs custom-profile allowlisting. Upload an avatar in Assets first."
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
      <Card title="Manage custom profiles">
        <Field label="Custom profile ID">
          <input value={profileId} onChange={(event) => setProfileId(event.target.value)} />
        </Field>
        <Field label="Cursor">
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
            kind="danger"
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
      title="Upload media"
      hint="Images go to POST /2/media/upload. Videos use initialize → append → finalize. The media ID is reused when you send a message."
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
  onRun: (request: ProxyRequest) => Promise<unknown>;
}) {
  const [eventId, setEventId] = useState("");
  const [cursor, setCursor] = useState("");

  return (
    <div className="grid two">
      <Card title="List inbox events" hint="GET /1.1/direct_messages/events/list.json">
        <Field label="Cursor">
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
      <Card title="Show or destroy an event" hint="GET events/show.json · DELETE events/destroy.json">
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
            kind="danger"
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
      <Card title="Mark read" hint="POST /1.1/direct_messages/mark_read.json — needs a recipient and an event ID.">
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
      <Card title="Typing indicator" hint="POST /1.1/direct_messages/indicate_typing.json">
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
    <Card title="Look up a user" hint="GET /1.1/users/show.json — resolves a handle to a numeric user ID and stores it as the recipient.">
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
