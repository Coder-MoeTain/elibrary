/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ADMIN_LOGIN_PATH?: string;
  /** `true` / `1` to show Closed Testing in admin sidebar. Default hidden. */
  readonly VITE_SHOW_CLOSED_TESTING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
