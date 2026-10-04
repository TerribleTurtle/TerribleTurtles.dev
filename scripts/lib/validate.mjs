// Tiny typed validation primitives for security/policy.json (no dependencies). Every failure throws PolicyError.

export class PolicyError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(`security/policy.json is invalid: ${message}`);
    this.name = 'PolicyError';
  }
}

/**
 * Reads a JSON object. With a non-empty key list, unknown keys fail; `$comment*` keys are always allowed and dropped.
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} required
 * @param {string[]} [optional]
 * @returns {Map<string, unknown>}
 */
export function record(value, path, required, optional = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new PolicyError(`${path}: expected an object`);
  /** @type {Map<string, unknown>} */
  const map = new Map(Object.entries(value));
  for (const key of map.keys()) {
    if (key.startsWith('$comment')) continue;
    if (required.length > 0 || optional.length > 0) {
      if (!required.includes(key) && !optional.includes(key)) throw new PolicyError(`${path || '(root)'}: unknown key "${key}"`);
    }
  }
  for (const key of required) if (!map.has(key)) throw new PolicyError(`${path ? `${path}.` : ''}${key}: missing`);
  for (const key of [...map.keys()]) if (key.startsWith('$comment')) map.delete(key);
  return map;
}

/** @param {unknown} v @param {string} path @returns {string} */
export function str(v, path) {
  if (typeof v !== 'string' || v.length === 0) throw new PolicyError(`${path}: expected a non-empty string`);
  return v;
}

/** @param {unknown} v @param {string} path @returns {string | undefined} */
export function optStr(v, path) {
  return v === undefined ? undefined : str(v, path);
}

/** @param {unknown} v @param {string} path @returns {number} */
export function int(v, path) {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new PolicyError(`${path}: expected an integer`);
  return v;
}

/** @param {unknown} v @param {string} path @param {boolean} [allowEmpty] @returns {string[]} */
export function strList(v, path, allowEmpty = false) {
  if (!Array.isArray(v)) throw new PolicyError(`${path}: expected an array of strings`);
  if (!allowEmpty && v.length === 0) throw new PolicyError(`${path}: expected a non-empty array`);
  return v.map((item, i) => str(item, `${path}[${i}]`));
}

/** @param {unknown} v @param {string} path @returns {unknown[]} */
export function list(v, path) {
  if (!Array.isArray(v) || v.length === 0) throw new PolicyError(`${path}: expected a non-empty array`);
  return v;
}

/** @param {string} source @param {string} path */
export function assertRegex(source, path) {
  try {
    new RegExp(source);
  } catch {
    throw new PolicyError(`${path}: not a valid regular expression: ${source}`);
  }
}
