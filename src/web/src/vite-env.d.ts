/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables used in the HotGigs application.
 * These environment variables are prefixed with VITE_ and are exposed to the client-side code.
 */
interface ImportMetaEnv {
  /** Supabase project URL for database and authentication services */
  readonly VITE_SUPABASE_URL: string;
  
  /** Supabase anonymous key for public API access */
  readonly VITE_SUPABASE_ANON_KEY: string;
  
  /** Base URL for the HotGigs API endpoints */
  readonly VITE_API_URL: string;
  
  /** OpenAI API key for AI-powered matching and analysis features */
  readonly VITE_OPENAI_API_KEY: string;
}

/**
 * Augments the ImportMeta interface to include typed environment variables.
 * This ensures type safety when accessing import.meta.env throughout the application.
 */
interface ImportMeta {
  /** Strongly-typed environment variables for the HotGigs application */
  readonly env: ImportMetaEnv;
}