import type { Config } from '@react-router/dev/config';

// Enable a router basename only during development. During build/production
// we avoid setting a basename so we still generates a index.html at the root
const isDev = import.meta.env.MODE === 'development';

export default {
  ssr: false,
  ...(isDev ? { basename: '/mcp-registry' } : {}),
  // If you prefer a trailing slash version, change above to '/mcp-registry/'.
  // https://reactrouter.com/start/framework/rendering#static-pre-rendering
  async prerender() {
    return ['/'];
  },
} satisfies Config;
