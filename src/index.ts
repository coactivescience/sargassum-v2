export interface Env {
  ASSETS: Fetcher;
  API_BASE_URL: string;
}

function javascript(value: unknown): Response {
  const serialized = JSON.stringify(value).replace(/</gu, "\\u003c");
  return new Response(`window.RUNTIME_CONFIG=${serialized};\n`, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/runtime-config.js") {
      if (!env.API_BASE_URL) {
        return new Response("Deployment configuration is incomplete", { status: 503 });
      }
      return javascript({ apiBaseUrl: env.API_BASE_URL });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
