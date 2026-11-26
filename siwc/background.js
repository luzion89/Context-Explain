import { channel, DEFAULT_SIWC_PORT } from "./client.js";
import { publicError, SiwcError } from "./errors.js";
import { authorize, exchange, listModels, readCallback, requestRefresh, revoke, streamResponse, verifyRefresh } from "./protocol.js";
import { consumeAttempt, loadProfiles, readRecord, removeRecord, saveProfiles, writeRecord } from "./store.js";

const refreshLeadMs = 60_000;
const outcomeKey = "siwc:last-sign-in";
const unusableTokens = new Set([
  "invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired",
  "refresh_token_invalidated", "refresh_token_reused", "invalid_id_token", "account_mismatch", "plan_scope_missing",
]);
const roles = new Set(["user", "assistant", "developer"]);
const cancelled = () => new SiwcError("cancelled", "操作已取消。");
const selected = state => state.profiles.find(profile => profile.id === state.activeProfileId);

function messagesFor(input) {
  const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
  if (!Array.isArray(messages) || !messages.length || messages.some(message =>
    !roles.has(message?.role) || typeof message.content !== "string" || !message.content.trim())) {
    throw new SiwcError("invalid_input", "SIWC requires text messages with a user, assistant, or developer role");
  }
  return messages.map(({ role, content }) => ({ role, content }));
}

function publicProfile(profile) {
  const { id, label, status, identity, session } = profile;
  return { id, label, status, sharing: Boolean(session), identity };
}

function snapshot(state, connecting = false) {
  const profile = selected(state);
  return {
    status: connecting ? "connecting" : profile?.status ?? "disconnected",
    sharing: Boolean(profile?.session),
    profileId: profile?.id,
    profileLabel: profile?.label,
    identity: profile?.identity,
    error: profile?.error,
  };
}

// Call once at the top level of the host extension's MV3 service worker.
export function registerSiwcBackground({ appName, pages, ruleId = 1, redirectPort = DEFAULT_SIWC_PORT, allowTabStream }) {
  if (typeof appName !== "string" || !appName.trim()) throw new Error("SIWC requires the host app name");
  if (!Array.isArray(pages) || !pages.length) throw new Error("SIWC requires a list of trusted extension pages");
  if (!Number.isInteger(ruleId) || ruleId < 1) throw new Error("SIWC requires a positive DNR rule ID");
  const trustedPages = new Set(pages.map(path => chrome.runtime.getURL(path)));
  const callbackPage = new URL("./callback.html", import.meta.url).href;
  const dnr = chrome.declarativeNetRequest;
  const expiryAlarm = "siwc-expire-attempt";
  let queue = Promise.resolve();
  let activeRequests = new AbortController();
  let activeExchange;

  function serialize(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }

  function stopRequests() {
    activeRequests.abort();
    activeRequests = new AbortController();
  }

  function publish(message) {
    void chrome.runtime.sendMessage({ channel, ...message }).catch(() => {});
  }

  function notifySession(state, connecting = false) {
    publish({ type: "sessionChanged", session: snapshot(state, connecting) });
  }

  async function clearAttempt() {
    await dnr.updateSessionRules({ removeRuleIds: [ruleId] });
    await chrome.alarms.clear(expiryAlarm);
    await removeRecord("attempt");
  }

  async function finish(id, outcome) {
    await chrome.storage.session.set({ [outcomeKey]: { id, ...outcome } });
    publish({ type: "signInFinished", id, ...outcome });
  }

  async function liveAttempt() {
    const attempt = await readRecord("attempt");
    if (!attempt) return;
    const rules = await dnr.getSessionRules();
    if (attempt.id && attempt.expiresAt > Date.now() && rules.some(rule => rule.id === ruleId)) return attempt;
    await clearAttempt();
    if (attempt.id) await finish(attempt.id, { error: publicError(new SiwcError("sign_in_interrupted", "授权已中断，请重新发起。")) });
  }

  async function start({ id, port = redirectPort, profileId, newProfile, label, reconsent }) {
    if (typeof id !== "string" || !id || (newProfile && profileId !== undefined) ||
        (label !== undefined && (typeof label !== "string" || !label.trim()))) {
      throw new SiwcError("invalid_input", "Invalid SIWC sign-in options");
    }
    if (await liveAttempt()) throw new SiwcError("sign_in_pending", "请先完成或关闭当前授权标签页");
    const state = await loadProfiles();
    const profile = newProfile ? undefined : state.profiles.find(profile => profile.id === (profileId ?? state.activeProfileId));
    if (profileId !== undefined && !profile) throw new SiwcError("unknown_profile", "所选 ChatGPT 账号不存在。");
    let hostId = await readRecord("hostId");
    if (!hostId) {
      hostId = "urn:uuid:" + crypto.randomUUID();
      await writeRecord("hostId", hostId);
    }
    const registration = profile && { clientId: profile.clientId, subject: profile.subject };
    const { transaction, url } = await authorize(hostId, { appName, port, registration, reconsent });
    const { id: tabId } = await chrome.tabs.create({ url: "about:blank" });
    try {
      await writeRecord("attempt", { ...transaction, id, tabId, profileId: profile?.id, label: label?.trim() });
      const escaped = transaction.redirectUri.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
      await dnr.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules: [{
          id: ruleId,
          priority: 1,
          action: { type: "redirect", redirect: { regexSubstitution: callbackPage + "\\1" } },
          condition: {
            regexFilter: "^" + escaped + "(\\?.*)?$",
            isUrlFilterCaseSensitive: true,
            tabIds: [tabId],
            resourceTypes: ["main_frame"],
            requestMethods: ["get"],
          },
        }],
      });
      await chrome.alarms.create(expiryAlarm, { when: transaction.expiresAt });
      await chrome.tabs.update(tabId, { url });
    } catch (error) {
      await clearAttempt();
      await chrome.tabs.remove(tabId).catch(() => {});
      throw error;
    }
    stopRequests();
    notifySession(state, true);
    return true;
  }

  async function complete(query, tabId) {
    const { attempt, registration } = await consumeAttempt(pending => {
      if (!pending?.id || pending.tabId !== tabId) throw new SiwcError("invalid_callback", "Unexpected callback tab");
      return { attempt: pending, registration: readCallback(query, pending) };
    });
    const controller = new AbortController();
    activeExchange = { id: attempt.id, controller };
    try {
      await clearAttempt();
      if (registration.declined) throw new SiwcError("authorization_declined", "OpenAI 授权未获同意。");
      const account = await exchange(registration, attempt, controller.signal);
      if (controller.signal.aborted) throw cancelled();
      const state = await loadProfiles();
      const existing = state.profiles.find(profile => profile.id === attempt.profileId || profile.clientId === account.clientId);
      if (existing?.subject && existing.subject !== account.subject) {
        throw new SiwcError("account_mismatch", "授权返回了不同的 ChatGPT 账号。");
      }
      if (controller.signal.aborted) throw cancelled();
      const id = existing?.id ?? crypto.randomUUID();
      const label = attempt.label ?? existing?.label ?? account.identity.email ?? "ChatGPT " + (state.profiles.length + 1);
      const updated = { ...account, id, label, status: "connected" };
      state.profiles = existing ? state.profiles.map(profile => profile.id === id ? updated : profile) : [...state.profiles, updated];
      stopRequests();
      state.activeProfileId = id;
      await saveProfiles(state);
      await finish(attempt.id, { result: snapshot(state) });
      notifySession(state);
      return { sharing: Boolean(updated.session) };
    } catch (error) {
      await finish(attempt.id, { error: publicError(error) });
      notifySession(await loadProfiles());
      throw error;
    } finally {
      activeExchange = undefined;
    }
  }

  async function cancelAttempt(id) {
    const attempt = await readRecord("attempt");
    if (!attempt || (id !== undefined && id !== attempt.id)) return;
    await clearAttempt();
    if (attempt.id) await finish(attempt.id, { error: publicError(cancelled()) });
    notifySession(await loadProfiles());
  }

  async function outcomeFor(id) {
    const attempt = await liveAttempt();
    const record = (await chrome.storage.session.get(outcomeKey))[outcomeKey];
    if (record?.id === id) return record;
    if (attempt?.id === id) return null;
    return { error: publicError(new SiwcError("sign_in_interrupted", "授权已中断，请重新发起。")) };
  }

  async function chooseProfile(id) {
    if (await liveAttempt()) throw new SiwcError("sign_in_pending", "请先完成或取消当前授权。");
    const state = await loadProfiles();
    if (!state.profiles.some(profile => profile.id === id)) throw new SiwcError("unknown_profile", "所选 ChatGPT 账号不存在。");
    if (state.activeProfileId !== id) {
      stopRequests();
      state.activeProfileId = id;
      await saveProfiles(state);
      notifySession(state);
    }
    return snapshot(state);
  }

  async function sessionForRequest() {
    if (await liveAttempt()) throw new SiwcError("sign_in_pending", "请先完成或取消当前授权。");
    const state = await loadProfiles();
    const profile = selected(state);
    if (profile?.status === "reauth_required") throw new SiwcError("reauth_required", "请重新完成 OpenAI 授权。");
    if (profile?.status !== "connected") throw new SiwcError("auth_required", "请先完成授权");
    const { session } = profile;
    if (!session) throw new SiwcError("plan_scope_missing", "需要在 OpenAI 页面授予 ChatGPT 套餐用量权限。");
    const now = Date.now();
    if (!session.pendingRotation) {
      if (session.expiresAt > now + refreshLeadMs) return session;
      if (session.earliestRefreshAt > now) {
        if (session.expiresAt > now) return session;
        throw new SiwcError("refresh_not_ready", "尚未到 OpenAI 允许续期的时间，请稍后重试。");
      }
    }

    try {
      const rotation = session.pendingRotation ?? await requestRefresh(session);
      if (rotation.idToken !== undefined && !session.pendingRotation) {
        // The remote refresh may already have consumed the old refresh token.
        profile.session = { ...session, pendingRotation: rotation };
        await saveProfiles(state);
      }
      await verifyRefresh(rotation);
      profile.session = rotation.next;
      await saveProfiles(state);
      if (rotation.next.expiresAt <= Date.now()) {
        throw new SiwcError("refresh_response_expired", "已保存轮换后的凭证，请重试以获取新 access token。");
      }
      return rotation.next;
    } catch (error) {
      if (!unusableTokens.has(error.code)) throw error;
      const failure = new SiwcError("reauth_required", "请重新完成 OpenAI 授权。", error);
      delete profile.session;
      profile.status = "reauth_required";
      profile.error = publicError(failure);
      await saveProfiles(state);
      notifySession(state);
      throw failure;
    }
  }

  async function withSession(signal, operation) {
    const turn = await serialize(async () => {
      if (signal.aborted) throw cancelled();
      return { session: await sessionForRequest(), signal: AbortSignal.any([signal, activeRequests.signal]) };
    });
    if (turn.signal.aborted) throw cancelled();
    return operation(turn.session, turn.signal);
  }

  async function disconnect() {
    stopRequests();
    await cancelAttempt();
    const state = await loadProfiles();
    const profile = selected(state);
    if (!profile) return;
    const session = profile.session;
    delete profile.session;
    delete profile.error;
    profile.status = "disconnected";
    await saveProfiles(state);
    notifySession(state);
    if (session) {
      try {
        await revoke(session.pendingRotation?.next ?? session);
      } catch {
        throw new SiwcError("remote_revocation_unconfirmed", "已移除本地凭证，远端撤销未确认。");
      }
    }
  }

  async function currentSession() {
    try {
      return snapshot(await loadProfiles(), Boolean(await liveAttempt()));
    } catch {
      const error = new SiwcError("credential_storage_unavailable", "暂时无法读取本机授权记录。");
      return { status: "reauth_required", sharing: false, error: publicError(error) };
    }
  }

  function isTrusted(sender) {
    return sender?.id === chrome.runtime.id && (sender.frameId === undefined || sender.frameId === 0);
  }

  function senderPage(sender) {
    return sender?.url?.split(/[?#]/, 1)[0];
  }

  function handle(message, sender) {
    switch (message.type) {
      case "start": return serialize(() => start(message));
      case "callback": return serialize(() => complete(message.query, sender.tab?.id));
      case "signInResult": return serialize(() => outcomeFor(message.id));
      case "cancelSignIn":
        if (activeExchange && (message.id === undefined || message.id === activeExchange.id)) activeExchange.controller.abort();
        return serialize(() => cancelAttempt(message.id));
      case "status": return serialize(currentSession);
      case "profiles": return serialize(async () => (await loadProfiles()).profiles.map(publicProfile));
      case "selectProfile": return serialize(() => chooseProfile(message.id));
      case "disconnect":
        activeExchange?.controller.abort();
        return serialize(disconnect);
      default: throw new SiwcError("invalid_input", "Unknown SIWC action");
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.channel !== channel || !isTrusted(sender) || ["sessionChanged", "signInFinished"].includes(message.type)) return;
    if (message.type === "callback" ? senderPage(sender) !== callbackPage : !trustedPages.has(senderPage(sender))) return;
    Promise.resolve().then(() => handle(message, sender))
      .then(result => sendResponse({ result }), error => sendResponse({ error: publicError(error) }));
    return true;
  });

  chrome.runtime.onConnect.addListener(port => {
    const fromTab = port.name === 'ctx-siwc-stream' && typeof allowTabStream === 'function';
    if (!fromTab && (port.name !== channel || !isTrusted(port.sender) || !trustedPages.has(senderPage(port.sender)))) return;
    const controller = new AbortController();
    port.onDisconnect.addListener(() => controller.abort());
    port.onMessage.addListener(function run(message) {
      port.onMessage.removeListener(run);
      const post = data => {
        if (controller.signal.aborted) return;
        try {
          port.postMessage(data);
        } catch {
          controller.abort();
        }
      };
      async function execute() {
        if (fromTab && (message?.type !== 'streamResponse' || !await allowTabStream(port.sender))) {
          throw new SiwcError('auth_required', 'Select Sign in with ChatGPT in Context Explain settings.');
        }
        return withSession(controller.signal, async (session, signal) => {
          if (message.type === "models") return listModels(session, signal);
          const { model, input, instructions } = message;
          if (message.type !== "streamResponse" || typeof model !== "string" ||
              (!model.trim() && !fromTab) ||
              (instructions !== undefined && typeof instructions !== "string")) {
            throw new SiwcError("invalid_input", "Invalid SIWC model request");
          }
          const messages = messagesFor(input);
          const slug = model.trim() || (await listModels(session, signal))[0]?.slug;
          if (!slug) throw new SiwcError('invalid_input', 'No models are available for this ChatGPT account.');
          const text = await streamResponse(session, {
            model: slug, input: messages, instructions, signal,
            onDelta: message.deltas ? delta => post({ delta }) : undefined,
          });
          return { text };
        });
      }
      execute().then(result => post({ result }), error => post({ error: publicError(error) }));
    });
  });

  chrome.tabs.onRemoved.addListener(tabId => {
    void serialize(async () => {
      const attempt = await readRecord("attempt");
      if (attempt?.tabId === tabId) await cancelAttempt(attempt.id);
    }).catch(() => {});
  });

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== expiryAlarm) return;
    void serialize(async () => {
      const hadAttempt = await readRecord("attempt");
      if (hadAttempt && !await liveAttempt()) notifySession(await loadProfiles());
    }).catch(() => {});
  });
}
