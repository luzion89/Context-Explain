export interface SiwcBackgroundOptions {
  appName: string;
  pages: readonly string[];
  ruleId?: number;
  redirectPort?: number;
  allowTabStream?: (sender: chrome.runtime.MessageSender) => boolean | Promise<boolean>;
}

export declare function registerSiwcBackground(options: SiwcBackgroundOptions): void;
