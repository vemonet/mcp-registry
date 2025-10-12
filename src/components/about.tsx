import { BookPlus, Search, Unplug, CheckCircle, Server, Info, TriangleAlert } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';

export const AboutPopup = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
          <Info className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">About the MCP Registry UI</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <Search className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
              <p>
                Unofficial web UI to explore the{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://github.com/modelcontextprotocol/registry"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  official registry
                </a>{' '}
                for{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://modelcontextprotocol.io/"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  Model Context Protocol (MCP)
                </a>{' '}
                servers.
              </p>
            </div>
            <div className="flex gap-3">
              <BookPlus className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
              <p>
                Follow the{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  official registry instructions
                </a>{' '}
                to publish your own MCP server.
              </p>
            </div>
            <div className="flex gap-3">
              <Unplug className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
              <p>You can point to a different registry URL that supports the same standards.</p>
            </div>
            <div className="flex gap-3">
              <Server className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
              <p>
                Build a stack with a list of MCP servers, that can then be exported in VSCode{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">mcp.json</code> or Cursor formats.
              </p>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
              <p>Everything happens on the client, nothing is stored on the server.</p>
            </div>
            <div className="flex gap-3 pt-3 border-t">
              <TriangleAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-yellow-500" />
              <p className="text-yellow-600 dark:text-yellow-500 font-medium">
                These servers have not been checked. Use at your own risk.
              </p>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
