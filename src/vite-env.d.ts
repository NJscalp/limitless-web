/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to `"false"` to disable demo scores and show an error if the backend does not return AI analysis. */
  readonly VITE_ALLOW_DEMO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
