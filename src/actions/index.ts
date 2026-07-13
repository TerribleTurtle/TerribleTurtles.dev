import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { env } from 'cloudflare:workers';

export const server = {
  // A test action to simulate an error for telemetry (Phase 3.4)
  simulateError: defineAction({
    accept: 'json',
    input: z.object({
      message: z.string(),
    }),
    handler: async (input, context) => {
      // In a real app, you might log this to console.error for Cloudflare Tail
      console.error(JSON.stringify({
        level: 'error',
        message: input.message,
        timestamp: new Date().toISOString(),
        // Stripped PII, no IP or user agent logged here natively
      }));
      
      throw new Error(`Simulated Error: ${input.message}`);
    },
  }),
};
