import { signOAuth1, type OAuthCredentials } from "./oauth1";

export type ProxyRequest = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  host?: "api.twitter.com" | "upload.twitter.com";
  query?: Record<string, string | undefined>;
  bodyType?: "json" | "form" | "none";
  body?: unknown;
};

export type ProxyResult = {
  ok: boolean;
  status: number;
  url: string;
  method: string;
  requestBody: unknown;
  body: unknown;
  ms: number;
};

function compactQuery(query?: Record<string, string | undefined>): Record<string, string> {
  const next: Record<string, string> = {};
  if (!query) return next;
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") next[key] = value;
  }
  return next;
}

function formEncode(body: Record<string, string>): string {
  return new URLSearchParams(body).toString();
}

export async function callXApi(request: ProxyRequest, credentials: OAuthCredentials): Promise<ProxyResult> {
  const host = request.host ?? "api.twitter.com";
  const query = compactQuery(request.query);
  const url = new URL(`https://${host}${request.path}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const bodyType = request.bodyType ?? "none";
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  let rawBody: string | undefined;
  let extraParams: Record<string, string> | undefined;
  if (bodyType === "json" && request.body !== undefined) {
    rawBody = JSON.stringify(request.body);
    headers["Content-Type"] = "application/json";
  } else if (bodyType === "form") {
    const form =
      request.body && typeof request.body === "object"
        ? compactQuery(request.body as Record<string, string | undefined>)
        : {};
    rawBody = formEncode(form);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    extraParams = form;
  }

  headers.Authorization = signOAuth1({
    method: request.method,
    url: url.toString(),
    credentials,
    extraParams,
  });

  const started = Date.now();
  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "DELETE" ? undefined : rawBody,
  });

  const text = await response.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  } else {
    parsed = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    url: url.toString(),
    method: request.method,
    requestBody: bodyType === "none" ? null : request.body ?? null,
    body: parsed,
    ms: Date.now() - started,
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

const MEDIA_V2 = "https://api.x.com/2/media/upload";

type MediaUploadInput = {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  mediaCategory: "dm_image" | "dm_gif" | "dm_video";
};

function parseJsonBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function mediaIdFrom(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  const candidates = [data?.id, data?.media_id_string, record.media_id_string, record.id];
  for (const value of candidates) {
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function processingInfo(body: unknown): { state?: string; check_after_secs?: number; error?: unknown } | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  const info = (data?.processing_info ?? record.processing_info) as
    | { state?: string; check_after_secs?: number; error?: unknown }
    | undefined;
  return info;
}

async function signedRequest(input: {
  method: "GET" | "POST";
  url: string;
  credentials: OAuthCredentials;
  extraParams?: Record<string, string>;
  headers?: Record<string, string>;
  body?: BodyInit;
}): Promise<{ ok: boolean; status: number; body: unknown; url: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...input.headers,
    Authorization: signOAuth1({
      method: input.method,
      url: input.url,
      credentials: input.credentials,
      extraParams: input.extraParams,
    }),
  };
  const response = await fetch(input.url, {
    method: input.method,
    headers,
    body: input.body,
  });
  return {
    ok: response.ok,
    status: response.status,
    url: input.url,
    body: parseJsonBody(await response.text()),
  };
}

export async function uploadMedia(
  input: MediaUploadInput,
  credentials: OAuthCredentials,
): Promise<ProxyResult> {
  const useChunked = input.mediaCategory === "dm_video" || input.bytes.byteLength > 4_500_000;
  if (useChunked) {
    return chunkedUploadV2(input, credentials);
  }
  return simpleUploadV2(input, credentials);
}

async function simpleUploadV2(
  input: MediaUploadInput,
  credentials: OAuthCredentials,
): Promise<ProxyResult> {
  const form = new FormData();
  form.set("media_category", input.mediaCategory);
  form.set("media_type", input.mimeType);
  form.set("media", new Blob([toArrayBuffer(input.bytes)], { type: input.mimeType }), input.filename);

  const started = Date.now();
  const result = await signedRequest({
    method: "POST",
    url: MEDIA_V2,
    credentials,
    body: form,
  });
  const mediaId = mediaIdFrom(result.body);

  return {
    ok: result.ok,
    status: result.status,
    url: result.url,
    method: "POST",
    requestBody: {
      mode: "simple",
      endpoint: "POST /2/media/upload",
      media_category: input.mediaCategory,
      media_type: input.mimeType,
      filename: input.filename,
      bytes: input.bytes.byteLength,
      media_id: mediaId,
    },
    body: mediaId ? { media_id: mediaId, ...(typeof result.body === "object" && result.body ? result.body : {}) } : result.body,
    ms: Date.now() - started,
  };
}

async function chunkedUploadV2(
  input: MediaUploadInput,
  credentials: OAuthCredentials,
): Promise<ProxyResult> {
  const started = Date.now();
  const steps: unknown[] = [];

  const init = await signedRequest({
    method: "POST",
    url: `${MEDIA_V2}/initialize`,
    credentials,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: input.mimeType,
      total_bytes: input.bytes.byteLength,
      media_category: input.mediaCategory,
    }),
  });
  steps.push({ step: "initialize", ...init });
  if (!init.ok) {
    return {
      ok: false,
      status: init.status,
      url: init.url,
      method: "POST",
      requestBody: { mode: "chunked", steps },
      body: init.body,
      ms: Date.now() - started,
    };
  }

  const mediaId = mediaIdFrom(init.body);
  if (!mediaId) {
    return {
      ok: false,
      status: init.status,
      url: init.url,
      method: "POST",
      requestBody: { mode: "chunked", steps },
      body: { error: "initialize succeeded but no media id was returned", init: init.body },
      ms: Date.now() - started,
    };
  }

  const chunkSize = 4 * 1024 * 1024;
  let segmentIndex = 0;
  for (let offset = 0; offset < input.bytes.byteLength; offset += chunkSize) {
    const chunk = input.bytes.slice(offset, offset + chunkSize);
    const form = new FormData();
    form.set("segment_index", String(segmentIndex));
    form.set(
      "media",
      new Blob([toArrayBuffer(chunk)], { type: "application/octet-stream" }),
      `chunk-${segmentIndex}`,
    );
    const append = await signedRequest({
      method: "POST",
      url: `${MEDIA_V2}/${mediaId}/append`,
      credentials,
      body: form,
    });
    steps.push({ step: "append", segment_index: segmentIndex, status: append.status, ok: append.ok });
    if (!append.ok) {
      return {
        ok: false,
        status: append.status,
        url: append.url,
        method: "POST",
        requestBody: { mode: "chunked", media_id: mediaId, steps },
        body: append.body,
        ms: Date.now() - started,
      };
    }
    segmentIndex += 1;
  }

  const finalized = await signedRequest({
    method: "POST",
    url: `${MEDIA_V2}/${mediaId}/finalize`,
    credentials,
  });
  steps.push({ step: "finalize", ...finalized });
  if (!finalized.ok) {
    return {
      ok: false,
      status: finalized.status,
      url: finalized.url,
      method: "POST",
      requestBody: { mode: "chunked", media_id: mediaId, steps },
      body: finalized.body,
      ms: Date.now() - started,
    };
  }

  let latest = finalized.body;
  let info = processingInfo(latest);
  let polls = 0;
  while (info && info.state !== "succeeded" && info.state !== "failed" && polls < 12) {
    const waitMs = Math.min(Math.max((info.check_after_secs ?? 1) * 1000, 500), 10_000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const statusUrl = `${MEDIA_V2}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`;
    const status = await signedRequest({
      method: "GET",
      url: statusUrl,
      credentials,
    });
    steps.push({ step: "status", ...status });
    if (!status.ok) {
      return {
        ok: false,
        status: status.status,
        url: status.url,
        method: "GET",
        requestBody: { mode: "chunked", media_id: mediaId, steps },
        body: status.body,
        ms: Date.now() - started,
      };
    }
    latest = status.body;
    info = processingInfo(latest);
    polls += 1;
  }

  const failed = info?.state === "failed";
  return {
    ok: !failed,
    status: failed ? 500 : finalized.status,
    url: finalized.url,
    method: "POST",
    requestBody: {
      mode: "chunked",
      endpoints: [
        "POST /2/media/upload/initialize",
        "POST /2/media/upload/{id}/append",
        "POST /2/media/upload/{id}/finalize",
        "GET /2/media/upload?command=STATUS",
      ],
      media_category: input.mediaCategory,
      media_type: input.mimeType,
      filename: input.filename,
      bytes: input.bytes.byteLength,
      media_id: mediaId,
      segments: segmentIndex,
      steps,
    },
    body: {
      media_id: mediaId,
      processing_info: info ?? null,
      ...(typeof latest === "object" && latest ? latest : { raw: latest }),
    },
    ms: Date.now() - started,
  };
}
