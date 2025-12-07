/**
 * Model capability data for a single model
 */
export interface ModelCapability {
  /** Model name/identifier */
  model: string;
  /** Dynamic capabilities - keys are column names, values are boolean support flags */
  capabilities: Record<string, boolean>;
}

/**
 * Provider data containing all models and their capabilities
 */
export interface ProviderData {
  /** Provider slug (e.g., "openai", "anthropic") */
  provider: string;
  /** Display name (e.g., "OpenAI", "Anthropic") */
  displayName: string;
  /** Source URL */
  url: string;
  /** Capability column names for this provider */
  columns: string[];
  /** List of models with their capabilities */
  models: ModelCapability[];
  /** ISO timestamp when this provider was scraped */
  scrapedAt: string;
}

/**
 * Root data structure for the registry
 */
export interface RegistryData {
  /** Schema version (increments when data structure changes) */
  version: number;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** List of all providers */
  providers: ProviderData[];
}

/**
 * Provider configuration for the crawler
 */
export interface ProviderConfig {
  /** Provider slug used in URL */
  slug: string;
  /** Display name */
  displayName: string;
}

/**
 * Summary of a provider (for /providers endpoint)
 */
export interface ProviderSummary {
  provider: string;
  displayName: string;
  modelCount: number;
  columns: string[];
  scrapedAt: string;
}
