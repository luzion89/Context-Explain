import { provider } from "./provider.js";
import { SiwcError } from "./errors.js";

const planScope = "chatgpt.tokens.use.direct";
const initialClient = "dynamic_agent_client";
const encoder = new TextEncoder();

export function callbackForPort(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new SiwcError("invalid_input", "请选择 1024 到 65535 之间的回调端口");
  }
  return "http://127.0.0.1:" + port + "/auth/callback";
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid ID token encoding");
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}

const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

export async function authorize(hostId, { appName, port, registration, reconsent }) {
  const transaction = {
    redirectUri: callbackForPort(port), registration,
    state: random(), nonce: random(), verifier: random(), expiresAt: Date.now() + 600_000,
  };
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(transaction.verifier));
  const url = new URL(provider.authorize);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: registration?.clientId ?? initialClient,
    ext_agent_host_id: hostId,
    redirect_uri: transaction.redirectUri,
    scope: "openid profile email offline_access resource.invoke " + planScope,
    resource: provider.resource,
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: "S256",
  });
  if (!registration) url.searchParams.set("agent_name_hint", appName);
  if (reconsent) url.searchParams.set("prompt", "consent");
  return { transaction, url: url.href };
}

export function readCallback(query, transaction) {
  const params = new URLSearchParams(query);
  if (!transaction || transaction.expiresAt <= Date.now() ||
      params.getAll("state").length !== 1 || params.get("state") !== transaction.state) {
    throw new SiwcError("invalid_state", "Unknown or expired sign-in state");
  }
  if (params.has("error")) return { declined: true };
  const returnedClientId = params.get("client_id");
  const savedClientId = transaction.registration?.clientId;
  const clientId = returnedClientId ?? savedClientId;
  const code = params.get("code");
  if (!code || params.getAll("code").length !== 1 ||
      params.getAll("client_id").length > 1 ||
      (savedClientId && returnedClientId !== null && returnedClientId !== savedClientId) ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(clientId ?? "") || clientId === initialClient) {
    throw new SiwcError("invalid_callback", "Incomplete registration callback");
  }
  return { code, clientId };
}

async function request(url, { signal, ...init } = {}, timeout = 15_000) {
  const deadline = AbortSignal.timeout(timeout);
  let response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    });
  } catch {
    if (signal?.aborted) throw new SiwcError("cancelled", "请求已取消。");
    if (deadline.aborted) throw new SiwcError("timeout", "OpenAI 请求超时。");
    throw new SiwcError("network_error", "暂时无法连接 OpenAI。");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const code = typeof body?.error === "string" ? body.error : body?.error?.code;
    const requestId = response.headers.get("x-request-id") ?? "";
    throw new SiwcError(
      typeof code === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(code) ? code : "http_error",
      new URL(url).pathname + " 返回 HTTP " + response.status,
      { status: response.status, requestId: /^[\w-]{1,128}$/.test(requestId) ? requestId : undefined },
    );
  }
  return response;
}

const invalidIdentity = message => new SiwcError("invalid_id_token", message);
const decoder = new TextDecoder();

async function verifyIdentity(token, clientId, nonce, verifiedAt = Date.now()) {
  let header;
  let payload;
  let signature;
  let kid;
  let claims;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw invalidIdentity("Invalid ID token");
    [header, payload] = parts;
    signature = decode(parts[2]);
    const metadata = JSON.parse(decoder.decode(decode(header)));
    kid = metadata.kid;
    if (metadata.alg !== "RS256" || typeof kid !== "string") throw invalidIdentity("Invalid ID token algorithm");
    claims = JSON.parse(decoder.decode(decode(payload)));
  } catch {
    throw invalidIdentity("Invalid ID token");
  }
  let key;
  const algorithm = "RSASSA-PKCS1-v1_5";
  try {
    const { keys } = await (await request(provider.jwks)).json();
    const jwk = keys.find(k => k.kid === kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256") && (!k.use || k.use === "sig"));
    key = await crypto.subtle.importKey("jwk", jwk, { name: algorithm, hash: "SHA-256" }, false, ["verify"]);
  } catch {
    throw new SiwcError("verification_unavailable", "暂时无法验证 OpenAI 签名，请重试。");
  }
  if (!await crypto.subtle.verify(algorithm, key, signature, encoder.encode(header + "." + payload))) {
    throw invalidIdentity("Invalid ID token signature");
  }
  if (!claims || typeof claims !== "object") throw invalidIdentity("Invalid ID token claims");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = verifiedAt / 1000;
  if (claims.iss !== provider.issuer || !audiences.includes(clientId) ||
      (nonce !== undefined && claims.nonce !== nonce) ||
      ((audiences.length > 1 || claims.azp !== undefined) && claims.azp !== clientId) ||
      !Number.isFinite(claims.iat) || claims.iat > now + 5 ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 5)) ||
      typeof claims.sub !== "string" || !claims.sub) throw invalidIdentity("Invalid ID token claims");
  const identity = {};
  if (typeof claims.name === "string") identity.name = claims.name;
  if (typeof claims.email === "string") identity.email = claims.email;
  return { subject: claims.sub, identity };
}

async function tokenGrant(fields, { priorScope, signal } = {}) {
  const response = await request(provider.token, {
    method: "POST",
    body: new URLSearchParams({ resource: provider.resource, ...fields }),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new SiwcError("invalid_response", "OpenAI 返回了无效的凭证数据。");
  }
  data.scope ??= priorScope;
  return data;
}

function hasPlanScope(data) {
  return typeof data.scope === "string" && data.scope.split(/\s+/).includes(planScope);
}

function toSession(data, clientId, subject, receivedAt = Date.now()) {
  if (typeof data.token_type !== "string" || data.token_type.toLowerCase() !== "bearer" ||
      typeof data.access_token !== "string" || !data.access_token ||
      typeof data.refresh_token !== "string" || !data.refresh_token ||
      !Number.isFinite(data.expires_in * 1000) || typeof data.expires_in !== "number" || data.expires_in <= 0) {
    throw new SiwcError("invalid_response", "OpenAI 返回了无效的凭证数据。");
  }
  return {
    subject, clientId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    scope: data.scope,
    expiresAt: receivedAt + data.expires_in * 1000,
    earliestRefreshAt: typeof data.earliest_refresh_at === "number"
      ? data.earliest_refresh_at * 1000
      : Date.parse(data.earliest_refresh_at) || 0,
  };
}

export async function exchange({ code, clientId }, { redirectUri, nonce, verifier, registration }, signal) {
  const data = await tokenGrant({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  }, { signal });
  const { subject, identity } = await verifyIdentity(data.id_token, clientId, nonce);
  if (registration && registration.subject !== subject) throw new SiwcError("account_mismatch", "授权返回了不同的 ChatGPT 账号");
  return { clientId, subject, identity, session: hasPlanScope(data) ? toSession(data, clientId, subject) : undefined };
}

export async function requestRefresh(session) {
  const data = await tokenGrant({
    grant_type: "refresh_token",
    client_id: session.clientId,
    refresh_token: session.refreshToken,
  }, { priorScope: session.scope });
  if (!hasPlanScope(data)) throw new SiwcError("plan_scope_missing", "缺少 ChatGPT 套餐授权。");
  const receivedAt = Date.now();
  return { next: toSession(data, session.clientId, session.subject, receivedAt), idToken: data.id_token, receivedAt };
}

export async function verifyRefresh({ next, idToken, receivedAt }) {
  if (idToken !== undefined && (await verifyIdentity(idToken, next.clientId, undefined, receivedAt)).subject !== next.subject) {
    throw new SiwcError("account_mismatch", "刷新返回了不同的账号");
  }
}

export async function revoke(session) {
  await request(provider.revoke, {
    method: "POST",
    body: new URLSearchParams({
      client_id: session.clientId, token: session.refreshToken, token_type_hint: "refresh_token",
    }),
  });
}

export async function listModels(session, signal) {
  const headers = { authorization: "Bearer " + session.accessToken };
  const data = await (await request(provider.resource + "/models", { headers, signal })).json().catch(() => null);
  if (!Array.isArray(data?.models)) throw new SiwcError("invalid_response", "OpenAI 返回了无效的模型列表。");
  return data.models.filter(model => model?.visibility === "list" && typeof model.slug === "string")
    .map(model => ({ slug: model.slug, displayName: typeof model.display_name === "string" ? model.display_name : model.slug }));
}

export async function streamResponse(session, { model, input, instructions, signal, onDelta }) {
  const response = await request(provider.resource + "/responses", {
    method: "POST",
    headers: {
      authorization: "Bearer " + session.accessToken,
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({ model, input, instructions, store: false, stream: true }),
    signal,
  }, 90_000);
  const contentType = response.headers.get("content-type");
  if (!response.body || (contentType && !contentType.startsWith("text/event-stream"))) {
    throw new SiwcError("invalid_response", "Expected an SSE stream");
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new SiwcError("stream_incomplete", "Stream ended before response.completed");
      buffer += value;
      for (let separator; (separator = /\r?\n\r?\n/.exec(buffer));) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const payload = frame.split(/\r?\n/).filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).replace(/^ /, "")).join("\n");
        if (!payload) continue;
        const event = JSON.parse(payload);
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
          onDelta?.(event.delta);
        }
        if (event.type === "response.completed") return text;
        if (["response.failed", "response.incomplete", "error"].includes(event.type)) {
          throw new SiwcError("response_failed", "Response failed");
        }
      }
    }
  } catch (error) {
    if (error instanceof SiwcError) throw error;
    if (signal?.aborted) throw new SiwcError("cancelled", "请求已取消。");
    if (error.name === "TimeoutError") throw new SiwcError("timeout", "OpenAI 响应超时。");
    throw new SiwcError("stream_incomplete", "OpenAI 响应流未能正常完成。");
  } finally {
    await reader.cancel().catch(() => {});
  }
}
