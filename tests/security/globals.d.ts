// Globals that the security tests read or that attack payloads try to set. Test-only; nothing ships.
export {};

declare global {
  /** Minimal Trusted Types surface the tests touch (TypeScript's lib.dom does not ship it). */
  interface TrustedTypePolicyFactoryLike {
    createPolicy(name: string, rules: { createHTML?: (input: string) => string }): unknown;
  }
  interface Window {
    /** Undefined in engines without Trusted Types support. */
    trustedTypes?: TrustedTypePolicyFactoryLike;
    /** Filled by the init script in tests/security/helpers.ts from `securitypolicyviolation` events. */
    __ttCspViolations?: string[];
    /** Set by an attack payload only if the attack succeeded. */
    __ttPwned?: string;
    /** Count of `load` events of the victim iframe in the embedder page. */
    __victimLoads?: number;
  }
}
