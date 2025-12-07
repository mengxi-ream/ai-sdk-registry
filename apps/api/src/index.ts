import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegistryData, ProviderSummary } from "@ai-sdk-registry/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    console.log(`Port ${port} is in use, trying ${port + 1}...`);
    port++;
    if (port > startPort + 100) {
      throw new Error("Could not find an available port");
    }
  }
  return port;
}

const app = new Hono();

// CORS - allow all origins
app.use("/*", cors());

// Rate limiting - 60 requests per minute per IP
const limiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 60, // 60 requests per window
  standardHeaders: "draft-6",
  keyGenerator: (c) =>
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown",
});

app.use("/*", limiter);

// Data file path
const dataPath = resolve(__dirname, "../../../data/data.json");

/**
 * Load registry data from disk
 */
function loadData(): RegistryData | null {
  if (!existsSync(dataPath)) {
    return null;
  }

  try {
    const content = readFileSync(dataPath, "utf-8");
    return JSON.parse(content) as RegistryData;
  } catch (error) {
    console.error("Failed to load data:", error);
    return null;
  }
}

// Health check
app.get("/health", (c) => {
  const data = loadData();
  return c.json({
    status: "ok",
    dataAvailable: data !== null,
    updatedAt: data?.updatedAt ?? null,
  });
});

// Get all data
app.get("/data", (c) => {
  const data = loadData();

  if (!data) {
    return c.json({ error: "Data not available. Crawler may not have run yet." }, 503);
  }

  return c.json(data);
});

// Get provider list (summary)
app.get("/providers", (c) => {
  const data = loadData();

  if (!data) {
    return c.json({ error: "Data not available. Crawler may not have run yet." }, 503);
  }

  const providers: ProviderSummary[] = data.providers.map((p) => ({
    provider: p.provider,
    displayName: p.displayName,
    modelCount: p.models.length,
    columns: p.columns,
    scrapedAt: p.scrapedAt,
  }));

  return c.json({
    providers,
    updatedAt: data.updatedAt,
    totalProviders: providers.length,
  });
});

// Get specific provider data
app.get("/data/:provider", (c) => {
  const provider = c.req.param("provider");
  const data = loadData();

  if (!data) {
    return c.json({ error: "Data not available. Crawler may not have run yet." }, 503);
  }

  const providerData = data.providers.find((p) => p.provider === provider);

  if (!providerData) {
    return c.json(
      {
        error: `Provider "${provider}" not found`,
        availableProviders: data.providers.map((p) => p.provider),
      },
      404
    );
  }

  return c.json(providerData);
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      availableEndpoints: ["/health", "/data", "/providers", "/data/:provider"],
    },
    404
  );
});

// Start server
const preferredPort = Number(process.env.PORT) || 3000;

findAvailablePort(preferredPort).then((port) => {
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`AI SDK Registry API running on http://localhost:${info.port}`);
      console.log(`Data file: ${dataPath}`);
    }
  );
});
