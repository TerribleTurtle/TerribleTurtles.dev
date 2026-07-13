import { env } from "cloudflare:workers";

/**
 * Server-side KV storage utility
 * Safe access to Cloudflare KV bindings.
 */
export const kvConfig = {
  async getThemePreference(userId: string): Promise<string | null> {
    try {
      return await env.CONFIG_KV.get(`theme:${userId}`);
    } catch (e) {
      console.error("KV Read Error:", e);
      return null;
    }
  },
  
  async setThemePreference(userId: string, theme: string): Promise<void> {
    try {
      await env.CONFIG_KV.put(`theme:${userId}`, theme);
    } catch (e) {
      console.error("KV Write Error:", e);
    }
  }
};
