import type { Config } from '@react-router/dev/config';

export default {
  ssr: false,
  basename: '/mcp-registry/',
  // https://reactrouter.com/start/framework/rendering#static-pre-rendering
  async prerender() {
    return ['/'];
  },
} satisfies Config;
