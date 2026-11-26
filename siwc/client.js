import { SiwcError } from "./errors.js";

export { SiwcError, SiwcError as ChatGPTError };
export const DEFAULT_SIWC_PORT = 51455;
export const channel = "siwc";

const cancelled = () => new SiwcError("cancelled", "操作已取消。");
const fromProblem = error => new SiwcError(error.code, error.message, error);

async function send(type, fields) {
  const reply = await chrome.runtime.sendMessage({ channel, type, ...fields }).catch(() => null);
  if (!reply) throw new SiwcError("background_unavailable", "SIWC background is unavailable for this extension page");
  if (reply.error) throw fromProblem(reply.error);
  return reply.result;
}

function waitForSignIn(id, signal) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let timer;
    const deadline = Date.now() + 660_000;
    function finish(complete, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(onMessage);
      signal?.removeEventListener("abort", abort);
      complete(value);
    }
    function abort() {
      void send("cancelSignIn", { id }).catch(() => {});
      finish(reject, cancelled());
    }
    function readOutcome(outcome) {
      if (outcome?.error) finish(reject, fromProblem(outcome.error));
      else if (outcome?.result) finish(resolve, outcome.result);
    }
    function onMessage(message, sender) {
      if (sender.id === chrome.runtime.id && message?.channel === channel &&
          message.type === "signInFinished" && message.id === id) readOutcome(message);
    }
    async function poll() {
      try {
        readOutcome(await send("signInResult", { id }));
      } catch (error) {
        if (error.code !== "background_unavailable") finish(reject, error);
      }
      if (finished) return;
      if (Date.now() >= deadline) {
        finish(reject, new SiwcError("sign_in_interrupted", "授权已超时，请重试。"));
      } else {
        // Chrome can suspend the Worker while the user is in the consent window.
        timer = setTimeout(poll, 35_000);
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else void poll();
  });
}

function request(type, fields, { signal, onDelta } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }
    const port = chrome.runtime.connect({ name: channel });
    let finished = false;
    function finish(complete, value) {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", abort);
      port.disconnect();
      complete(value);
    }
    function abort() {
      finish(reject, cancelled());
    }
    signal?.addEventListener("abort", abort, { once: true });
    port.onDisconnect.addListener(() => {
      // Read lastError in this event without returning internal Chrome diagnostics.
      void chrome.runtime.lastError;
      finish(reject, new SiwcError("request_interrupted", "与扩展后台的连接已中断。"));
    });
    port.onMessage.addListener(message => {
      if (message.error) finish(reject, fromProblem(message.error));
      else if ("result" in message) finish(resolve, message.result);
      else if (typeof message.delta === "string") {
        try {
          onDelta?.(message.delta);
        } catch (error) {
          finish(reject, error);
        }
      }
    });
    try {
      port.postMessage({ type, ...fields, deltas: Boolean(onDelta) });
    } catch {
      finish(reject, new SiwcError("request_interrupted", "与扩展后台的连接已中断。"));
    }
  });
}

export function createChatGPT() {
  const streamResponse = ({ signal, onDelta, ...fields }) => request("streamResponse", fields, { signal, onDelta });
  const subscribe = listener => {
    let current = true;
    let notified = false;
    const handle = (message, sender) => {
      if (sender.id === chrome.runtime.id && message?.channel === channel && message.type === "sessionChanged") {
        notified = true;
        listener(message.session);
      }
    };
    chrome.runtime.onMessage.addListener(handle);
    void send("status").then(session => {
      if (current && !notified) listener(session);
    }).catch(() => {});
    return () => {
      current = false;
      chrome.runtime.onMessage.removeListener(handle);
    };
  };

  return {
    async signIn({ signal, ...options } = {}) {
      if (signal?.aborted) throw cancelled();
      const id = crypto.randomUUID();
      await send("start", { ...options, id });
      return waitForSignIn(id, signal);
    },
    cancelSignIn() {
      void send("cancelSignIn").catch(() => {});
    },
    getSession() {
      return send("status");
    },
    listProfiles() {
      return send("profiles");
    },
    selectProfile(id) {
      return send("selectProfile", { id });
    },
    listModels(options) {
      return request("models", {}, options);
    },
    streamResponse,
    subscribe,
    disconnect() {
      return send("disconnect");
    },
    generateText: streamResponse,
    onSessionChanged: subscribe,
  };
}

export const createSiwcClient = createChatGPT;
