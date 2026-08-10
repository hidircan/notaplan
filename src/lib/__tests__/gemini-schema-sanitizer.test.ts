import { describe, it, expect } from "vitest";
import { sanitizeSchemaForGemini, toolsToGemini } from "../ai/providers/gemini";
import { listToolDefinitions } from "../agent";
import type { ToolDescriptor } from "../ai/types";

const FORBIDDEN_KEYS = ["$schema", "additionalProperties", "propertyNames"];

function collectKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(v, keys);
  }
}

describe("sanitizeSchemaForGemini — Gemini'nin desteklemediği alanları temizler", () => {
  it("üst seviyedeki $schema / additionalProperties alanlarını kaldırır", () => {
    const input = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    };
    const result = sanitizeSchemaForGemini(input) as Record<string, unknown>;
    expect(result).not.toHaveProperty("$schema");
    expect(result).not.toHaveProperty("additionalProperties");
    expect(result.type).toBe("object");
    expect(result.required).toEqual(["name"]);
  });

  it("iç içe (nested) şemalardan da (properties/items/anyOf içinde) temizler", () => {
    const input = {
      type: "object",
      properties: {
        student: {
          $schema: "x",
          type: "object",
          additionalProperties: {},
          properties: {
            id: { type: "string" },
          },
        },
        tags: {
          type: "array",
          items: { type: "string", additionalProperties: false },
        },
        variant: {
          anyOf: [{ type: "string", propertyNames: { type: "string" } }, { type: "number" }],
        },
      },
      propertyNames: { type: "string" },
    };
    const result = sanitizeSchemaForGemini(input);
    const keys = new Set<string>();
    collectKeys(result, keys);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
    // Structure otherwise preserved.
    const asRecord = result as Record<string, unknown>;
    const properties = asRecord.properties as Record<string, unknown>;
    expect(properties.student).toBeTruthy();
    expect(properties.tags).toBeTruthy();
  });

  it("izinli alanları (type, description, enum, required, format...) DOKUNMADAN korur", () => {
    const input = {
      type: "string",
      description: "Enstrüman adı",
      enum: ["Piyano", "Gitar"],
      format: "email",
    };
    expect(sanitizeSchemaForGemini(input)).toEqual(input);
  });

  it("primitive/null/undefined girdilerde olduğu gibi döner, fırlatmaz", () => {
    expect(sanitizeSchemaForGemini(null)).toBeNull();
    expect(sanitizeSchemaForGemini(undefined)).toBeUndefined();
    expect(sanitizeSchemaForGemini("x")).toBe("x");
    expect(sanitizeSchemaForGemini(42)).toBe(42);
  });

  it("girdiyi mutasyona uğratmaz (yeni bir nesne döner)", () => {
    const input = { $schema: "x", type: "object" };
    const result = sanitizeSchemaForGemini(input) as Record<string, unknown>;
    expect(input).toHaveProperty("$schema"); // orijinal değişmedi
    expect(result).not.toHaveProperty("$schema");
  });
});

describe("toolsToGemini — kayıt defterindeki GERÇEK araç şemalarında yasaklı alan kalmaz", () => {
  it("listToolDefinitions()'daki tüm araçlar (ör. z.record kullanan emptyOrRecord) Gemini'ye temiz gider", () => {
    const tools: ToolDescriptor[] = listToolDefinitions();
    expect(tools.length).toBeGreaterThan(0);

    const geminiTools = toolsToGemini(tools);
    const serialized = JSON.stringify(geminiTools);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(serialized.includes(`"${forbidden}"`)).toBe(false);
    }
    // Sanity: gerçek alanlar hâlâ orada.
    expect(geminiTools[0].functionDeclarations.length).toBe(tools.length);
    expect(geminiTools[0].functionDeclarations.every((f) => typeof f.name === "string")).toBe(true);
  });

  it("boş inputSchema durumunda varsayılan {type:'object', properties:{}} kullanır", () => {
    const tools: ToolDescriptor[] = [{ name: "noop", description: "test", requiredRoles: [] }];
    const geminiTools = toolsToGemini(tools);
    expect(geminiTools[0].functionDeclarations[0].parameters).toEqual({
      type: "object",
      properties: {},
    });
  });
});
