import { channel } from "./client.js";

const query = location.search;
history.replaceState(null, "", location.pathname);
const status = document.querySelector("#status");

const copy = {
  en: {
    heading: "Account authorization",
    pending: "Verifying authorization…",
    hint: "When finished, you can close this tab and return to the extension.",
    connected: "ChatGPT connected. Authorization successful.",
    identityOnly: "Signed in to ChatGPT. Plan usage access has not been granted.",
    rejected: "ChatGPT authorization could not be completed. Return to the extension and try again.",
  },
  "zh-CN": {
    heading: "账号授权",
    pending: "正在验证授权…",
    hint: "完成后可以关闭此标签页，返回扩展。",
    connected: "ChatGPT 连接成功，授权成功。",
    identityOnly: "ChatGPT 登录成功，尚未授予套餐用量权限。",
    rejected: "未能完成 ChatGPT 授权，请返回扩展后重试。",
  },
};

const settings = await chrome.storage.sync.get("responseLang").catch(() => ({}));
const language = settings.responseLang?.startsWith("Chinese") ? "zh-CN" : "en";
const messages = copy[language];
document.documentElement.lang = language;
document.querySelector("#heading").textContent = messages.heading;
document.querySelector("#return-hint").textContent = messages.hint;
status.textContent = messages.pending;

try {
  const { result } = await chrome.runtime.sendMessage({ channel, type: "callback", query });
  if (!result) throw new Error("Authorization failed");
  status.textContent = result.sharing ? messages.connected : messages.identityOnly;
  status.dataset.result = "connected";
} catch {
  status.textContent = messages.rejected;
  status.dataset.result = "rejected";
}
