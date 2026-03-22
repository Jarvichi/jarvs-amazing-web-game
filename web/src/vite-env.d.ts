/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __BUILD_DATE__: string

interface ImportMetaEnv {
  readonly VITE_GIT_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
