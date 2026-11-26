export declare const DEFAULT_SIWC_PORT: 51455;

export interface SessionError {
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
  requestId?: string;
}

export declare class SiwcError extends Error implements SessionError {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, details?: { status?: number; requestId?: string; retryable?: boolean });
}
export { SiwcError as ChatGPTError };

export interface SessionIdentity {
  name?: string;
  email?: string;
}

export interface SessionState {
  status: "disconnected" | "connecting" | "connected" | "reauth_required";
  sharing: boolean;
  profileId?: string;
  profileLabel?: string;
  identity?: SessionIdentity;
  error?: SessionError;
}

export interface LoginProfile {
  id: string;
  label: string;
  status: SessionState["status"];
  sharing: boolean;
  identity?: SessionIdentity;
}

export interface ChatGPTModel {
  slug: string;
  displayName: string;
}

export interface ResponseInputMessage {
  role: "user" | "assistant" | "developer";
  content: string;
}

export interface StreamResponseOptions {
  model: string;
  input: string | readonly ResponseInputMessage[];
  instructions?: string;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

export interface SignInOptions {
  signal?: AbortSignal;
  newProfile?: boolean;
  profileId?: string;
  label?: string;
  reconsent?: boolean;
  port?: number;
}

export interface ChatGPTClient {
  signIn(options?: SignInOptions): Promise<SessionState>;
  cancelSignIn(): void;
  getSession(): Promise<SessionState>;
  listProfiles(): Promise<LoginProfile[]>;
  selectProfile(id: string): Promise<SessionState>;
  listModels(options?: { signal?: AbortSignal }): Promise<ChatGPTModel[]>;
  subscribe(listener: (session: SessionState) => void): () => void;
  disconnect(): Promise<void>;
  streamResponse(options: StreamResponseOptions): Promise<{ text: string }>;
  generateText(options: StreamResponseOptions): Promise<{ text: string }>;
  onSessionChanged(listener: (session: SessionState) => void): () => void;
}

export declare function createChatGPT(): ChatGPTClient;
export declare const createSiwcClient: typeof createChatGPT;
