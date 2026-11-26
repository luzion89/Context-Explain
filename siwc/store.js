const dbName = "siwc-extension";
const table = "records";
let database;

function open() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(table);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => {
    database = undefined;
    throw error;
  });
  return database;
}

async function record(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, mode);
    const request = action(tx.objectStore(table));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export const readRecord = name => record("readonly", store => store.get(name));
export const writeRecord = (name, value) => record("readwrite", store => store.put(value, name));
export const removeRecord = name => record("readwrite", store => store.delete(name));

export async function consumeAttempt(validate) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, "readwrite");
    const store = tx.objectStore(table);
    const lookup = store.get("attempt");
    let result;
    lookup.onsuccess = () => {
      try {
        result = validate(lookup.result);
        store.delete("attempt");
      } catch (error) {
        reject(error);
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyName = "profiles-key:v2";
const profilesName = "profiles:v2";
const oldSession = "session:openai";
const oldKey = "session-key:openai";
const oldRegistration = "openai-registration";

async function unseal(name, key, envelope) {
  const algorithm = { name: "AES-GCM", iv: envelope.iv, additionalData: encoder.encode(name) };
  const plaintext = await crypto.subtle.decrypt(algorithm, key, envelope.ciphertext);
  return JSON.parse(decoder.decode(plaintext));
}

export async function loadProfiles() {
  const envelope = await readRecord(profilesName);
  if (envelope) return unseal(profilesName, await readRecord(keyName), envelope);

  const registration = await readRecord(oldRegistration);
  if (!registration) return { profiles: [], activeProfileId: undefined };
  const legacyEnvelope = await readRecord(oldSession);
  const { [oldKey]: bytes } = await chrome.storage.session.get(oldKey);
  let session;
  if (legacyEnvelope && bytes) {
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(bytes), "AES-GCM", false, ["decrypt"]);
    session = await unseal(oldSession, key, legacyEnvelope);
  }
  const id = crypto.randomUUID();
  const state = {
    activeProfileId: id,
    profiles: [{ ...registration, id, label: "ChatGPT", status: session ? "connected" : "disconnected", session }],
  };
  await saveProfiles(state, true);
  await chrome.storage.session.remove(oldKey);
  return state;
}

export async function saveProfiles(state, migrate = false) {
  const storedKey = await readRecord(keyName);
  const key = storedKey ?? await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const algorithm = { name: "AES-GCM", iv, additionalData: encoder.encode(profilesName) };
  const ciphertext = await crypto.subtle.encrypt(algorithm, key, encoder.encode(JSON.stringify(state)));
  await record("readwrite", store => {
    if (!storedKey) store.add(key, keyName);
    if (migrate) {
      store.delete(oldSession);
      store.delete(oldRegistration);
    }
    return store.put({ iv, ciphertext }, profilesName);
  });
}
