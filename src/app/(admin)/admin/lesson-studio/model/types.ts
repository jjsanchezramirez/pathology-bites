// Re-export shim. The canonical lesson model now lives in src/shared/lesson/types.ts
// so both the admin editor and the public player can import it. Existing relative
// imports (`../model/types`) continue to work through this file.

export * from "@/shared/lesson/types";
