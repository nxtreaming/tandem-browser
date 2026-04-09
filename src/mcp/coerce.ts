import { z } from 'zod';

/**
 * Wrap Zod schema fields with z.preprocess() to coerce string values from MCP
 * clients that serialize all parameters as strings.
 *
 * This must happen at the schema level because the MCP SDK validates arguments
 * against the Zod schema BEFORE calling the tool handler.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function coerceShape(shape: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {};
  for (const [key, field] of Object.entries(shape)) {
    const inner = unwrapType(field);
    if (inner instanceof z.ZodBoolean) {
      result[key] = z.preprocess(coerceBool, field);
    } else if (inner instanceof z.ZodNumber) {
      result[key] = z.preprocess(coerceNum, field);
    } else if (inner instanceof z.ZodArray) {
      result[key] = z.preprocess(coerceArr, field);
    } else {
      result[key] = field;
    }
  }
  return result;
}

/** Unwrap ZodOptional / ZodDefault / ZodNullable wrappers to find the base type. */
function unwrapType(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s = schema;
  while (
    s instanceof z.ZodOptional ||
    s instanceof z.ZodDefault ||
    s instanceof z.ZodNullable
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s = (s._def as any).innerType as z.ZodTypeAny;
  }
  return s;
}

/** "true"/"1" -> true, "false"/"0" -> false, pass through otherwise. */
function coerceBool(val: unknown): unknown {
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return val;
}

/** String number -> number when finite, pass through otherwise. */
function coerceNum(val: unknown): unknown {
  if (typeof val === 'string' && val !== '') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return val;
}

/** JSON string -> array if valid, pass through otherwise. */
function coerceArr(val: unknown): unknown {
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not valid JSON */ }
  }
  return val;
}
