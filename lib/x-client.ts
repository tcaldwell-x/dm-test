import { getCredentials, signOAuth1, type OAuthCredentials } from "./oauth";

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

export async function callXApi(request: ProxyRequest): Promise<ProxyResult> {
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error(
      "Missing X API credentials. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET.",
    );
  }

  return callXApiWithCredentials(request, credentials);
}

export async function callXApiWithCredentials(
  request: ProxyRequest,
  credentials: OAuthCredentials,
): Promise<ProxyResult> {
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

export async function uploadMedia(input: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  mediaCategory: "dm_image" | "dm_gif" | "dm_video";
}): Promise<ProxyResult> {
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error(
      "Missing X API credentials. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET.",
    );
  }

  const isChunked = input.mediaCategory === "dm_video" || input.bytes.byteLength > 4_500_000;
  if (!isChunked) {
    return simpleUpload(credentials, input);
  }
  return chunkedUpload(credentials, input);
}

async function simpleUpload(
  credentials: OAuthCredentials,
  input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    mediaCategory: "dm_image" | "dm_gif" | "dm_video";
  },
): Promise<ProxyResult> {
  const extraParams = {
    media_category: input.mediaCategory,
  };
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const form = new FormData();
  form.set("media_category", input.mediaCategory);
  form.set(
    "media",
    new Blob([toArrayBuffer(input.bytes)], { type: input.mimeType }),
    input.filename,
  );

  const started = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: signOAuth1({
        method: "POST",
        url,
        credentials,
        extraParams,
      }),
    },
    body: form,
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    url,
    method: "POST",
    requestBody: {
      media_category: input.mediaCategory,
      filename: input.filename,
      bytes: input.bytes.byteLength,
      mode: "simple",
    },
    body: parsed,
    ms: Date.now() - started,
  };
}

async function chunkedUpload(
  credentials: OAuthCredentials,
  input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    mediaCategory: "dm_image" | "dm_gif" | "dm_video";
  },
): Promise<ProxyResult> {
  const started = Date.now();
  const init = await callXApiWithCredentials(
    {
      method: "POST",
      host: "upload.twitter.com",
      path: "/1.1/media/upload.json",
      bodyType: "form",
      body: {
        command: "INIT",
        total_bytes: String(input.bytes.byteLength),
        media_type: input.mimeType,
        media_category: input.mediaCategory,
      },
    },
    credentials,
  );

  if (!init.ok) return init;
  const mediaId = (init.body as { media_id_string?: string })?.media_id_string;
  if (!mediaId) {
    return {
      ...init,
      ok: false,
      body: { error: "INIT succeeded but no media_id_string was returned", init: init.body },
    };
  }

  const chunkSize = 4 * 1024 * 1024;
  let segmentIndex = 0;
  for (let offset = 0; offset < input.bytes.byteLength; offset += chunkSize) {
    const chunk = input.bytes.slice(offset, offset + chunkSize);
    const url = "https://upload.twitter.com/1.1/media/upload.json";
    const extraParams = {
      command: "APPEND",
      media_id: mediaId,
      segment_index: String(segmentIndex),
    };
    const form = new FormData();
    form.set("command", "APPEND");
    form.set("media_id", mediaId);
    form.set("segment_index", String(segmentIndex));
    form.set(
      "media",
      new Blob([toArrayBuffer(chunk)], { type: "application/octet-stream" }),
      `chunk-${segmentIndex}`,
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: signOAuth1({
          method: "POST",
          url,
          credentials,
          extraParams,
        }),
      },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        status: response.status,
        url,
        method: "POST",
        requestBody: extraParams,
        body: text || { error: "APPEND failed" },
        ms: Date.now() - started,
      };
    }
    segmentIndex += 1;
  }

  const finalized = await callXApiWithCredentials(
    {
      method: "POST",
      host: "upload.twitter.com",
      path: "/1.1/media/upload.json",
      bodyType: "form",
      body: {
        command: "FINALIZE",
        media_id: mediaId,
      },
    },
    credentials,
  );

  return {
    ...finalized,
    requestBody: {
      media_category: input.mediaCategory,
      filename: input.filename,
      bytes: input.bytes.byteLength,
      mode: "chunked",
      media_id: mediaId,
    },
    ms: Date.now() - started,
  };
}
