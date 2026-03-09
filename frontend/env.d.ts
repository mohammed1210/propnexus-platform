/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_BACKEND_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
    NEXT_PUBLIC_API_BASE?: string;
  }
}
