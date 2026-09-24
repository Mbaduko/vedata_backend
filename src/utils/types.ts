import { Request } from 'express';

/**
 * Extract a string param from Express 5's string | string[] type.
 */
export function getParam(req: Request, name: string): string {
  const val = (req.params as Record<string, string | string[]>)[name];
  return Array.isArray(val) ? val[0] : (val ?? '');
}

/**
 * Extract a string query param safely.
 */
export function getQuery(req: Request, name: string): string {
  const val = (req.query as Record<string, string | string[]>)[name];
  return Array.isArray(val) ? val[0] : (val ?? '');
}

/**
 * Get all query params as a flat Record<string, string>.
 */
export function getQueryParams(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.query)) {
    result[key] = Array.isArray(val) ? String(val[0]) : String(val ?? '');
  }
  return result;
}
