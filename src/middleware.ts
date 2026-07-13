import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const response = await next();
    return response;
  } catch (error) {
    // Dynamic error catching and telemetry logging
    const message = error instanceof Error ? error.message : String(error);
    
    // Log to console.error which integrates with Cloudflare Tail
    console.error(JSON.stringify({
      level: 'error',
      message: message,
      url: context.url.href,
      timestamp: new Date().toISOString()
    }));

    // Return a generic 500 error response
    return new Response(JSON.stringify({
      error: 'Internal Server Error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
