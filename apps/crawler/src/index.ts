import { CheerioCrawler, log } from "crawlee";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProviderData, RegistryData } from "@ai-sdk-registry/types";
import { parseCapabilitiesTable, findCapabilitiesTable } from "./parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://ai-sdk.dev";
const PROVIDERS_INDEX_URL = `${BASE_URL}/providers/ai-sdk-providers`;

// Store scraped data
const providerResults: Map<string, ProviderData> = new Map();

// Create the crawler
const crawler = new CheerioCrawler({
  maxConcurrency: 5,
  maxRequestRetries: 2,
  requestHandlerTimeoutSecs: 30,

  async requestHandler({ request, $, crawler }) {
    const url = request.url;
    const label = request.label;

    // Phase 1: Discovery - extract provider links from index page
    if (label === "discovery") {
      log.info("Discovering providers...", { url });

      // Find all provider links in the sidebar/content
      const providerLinks: { slug: string; displayName: string; url: string }[] = [];

      $('a[href^="/providers/ai-sdk-providers/"]').each((_, el) => {
        const href = $(el).attr("href");
        if (!href || href === "/providers/ai-sdk-providers") return;

        const slug = href.split("/").pop();
        if (!slug) return;

        // Skip duplicates
        if (providerLinks.some((p) => p.slug === slug)) return;

        const displayName = $(el).text().trim();
        providerLinks.push({
          slug,
          displayName: displayName || slug,
          url: `${BASE_URL}${href}`,
        });
      });

      log.info(`Found ${providerLinks.length} providers`, {
        providers: providerLinks.map((p) => p.slug),
      });

      // Add provider pages to crawl queue
      await crawler.addRequests(
        providerLinks.map((provider) => ({
          url: provider.url,
          label: "provider",
          userData: {
            slug: provider.slug,
            displayName: provider.displayName,
          },
        }))
      );

      return;
    }

    // Phase 2: Scrape individual provider pages
    const slug = request.userData.slug as string;
    const displayName = request.userData.displayName as string;

    log.info(`Scraping ${displayName}...`, { url });

    // Find the capabilities table
    const table = findCapabilitiesTable($);

    if (!table) {
      log.warning(`No capabilities table found for ${displayName}`, { url });
      return;
    }

    // Parse the table
    const { columns, models } = parseCapabilitiesTable($, table);

    if (models.length === 0) {
      log.warning(`No models found for ${displayName}`, { url });
      return;
    }

    log.info(`Found ${models.length} models for ${displayName}`, {
      columns,
      modelCount: models.length,
    });

    // Store the result
    providerResults.set(slug, {
      provider: slug,
      displayName,
      url,
      columns,
      models,
      scrapedAt: new Date().toISOString(),
    });
  },

  async failedRequestHandler({ request }, error) {
    log.error(`Failed to scrape ${request.url}`, { error: error.message });
  },
});

async function main() {
  log.info("Starting AI SDK Registry Crawler...");

  // Start with discovery request
  await crawler.run([
    {
      url: PROVIDERS_INDEX_URL,
      label: "discovery",
    },
  ]);

  // Build the registry data
  const registryData: RegistryData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    providers: Array.from(providerResults.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    ),
  };

  // Output path - write to project root /data directory
  const outputPath = resolve(__dirname, "../../../data/data.json");

  // Ensure directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Write the data
  writeFileSync(outputPath, JSON.stringify(registryData, null, 2));

  log.info(`Crawl complete!`, {
    providersScraped: providerResults.size,
    outputPath,
  });
}

main().catch((error) => {
  log.error("Crawler failed", { error: error.message });
  process.exit(1);
});
