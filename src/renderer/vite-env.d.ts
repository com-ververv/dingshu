/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_E2E_BROWSER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
