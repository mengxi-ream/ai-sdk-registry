import type { CheerioAPI, Cheerio, Element } from "crawlee";
import type { ModelCapability } from "@ai-sdk-registry/types";

export interface ParseResult {
  columns: string[];
  models: ModelCapability[];
}

/**
 * Parse the Model Capabilities table from a provider page
 *
 * Table structure:
 * - First column is always "Model" (model name in <code> tag)
 * - Subsequent columns are capability names
 * - Boolean values are indicated by presence of <svg> elements (checkmark icons)
 */
export function parseCapabilitiesTable(
  $: CheerioAPI,
  table: Cheerio<Element>
): ParseResult {
  const columns: string[] = [];
  const models: ModelCapability[] = [];

  // Extract column headers (skip first "Model" column)
  table.find("thead th, tr:first-child th").each((idx, el) => {
    if (idx > 0) {
      const text = $(el).text().trim();
      if (text) {
        columns.push(text);
      }
    }
  });

  // If no thead, try first row
  if (columns.length === 0) {
    table.find("tr:first-child td, tr:first-child th").each((idx, el) => {
      if (idx > 0) {
        const text = $(el).text().trim();
        if (text) {
          columns.push(text);
        }
      }
    });
  }

  // Extract model data from table body
  table.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length === 0) return;

    // Model name is in the first cell, typically in a <code> tag
    const firstCell = cells.first();
    let modelName = firstCell.find("code").text().trim();

    // Fallback: get text directly if no <code> tag
    if (!modelName) {
      modelName = firstCell.text().trim();
    }

    if (!modelName) return;

    // Parse capabilities (remaining cells)
    const capabilities: Record<string, boolean> = {};

    cells.slice(1).each((idx, cell) => {
      if (idx < columns.length) {
        // Check for SVG (checkmark icon) to determine boolean value
        const hasSvg = $(cell).find("svg").length > 0;
        capabilities[columns[idx]] = hasSvg;
      }
    });

    models.push({
      model: modelName,
      capabilities,
    });
  });

  return { columns, models };
}

/**
 * Find the Model Capabilities table on the page
 * Returns the first table that appears to be a capabilities table
 */
export function findCapabilitiesTable(
  $: CheerioAPI
): Cheerio<Element> | null {
  // Look for heading containing "Model Capabilities" and get the next table
  const heading = $('h2:contains("Model Capabilities"), h3:contains("Model Capabilities")').first();

  if (heading.length > 0) {
    // Find the next table after this heading
    const nextTable = heading.nextAll("table").first();
    if (nextTable.length > 0) {
      return nextTable;
    }
  }

  // Fallback: just get the first table on the page
  const firstTable = $("table").first();
  return firstTable.length > 0 ? firstTable : null;
}
