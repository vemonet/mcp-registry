import { useState, useEffect, useCallback } from 'react';
import { Search, Unplug, Server, Trash2, Download } from 'lucide-react';

import { buildIdeConfigForPkg, buildIdeConfigForRemote } from '~/lib/ide-config';
import { Card } from '~/components/ui/card';
import { ThemeToggle } from '~/components/theme/theme-toggle';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '~/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import VscodeLogo from '~/components/logos/vscode-logo.svg';
import CursorLogo from '~/components/logos/cursor-logo.svg';
import McpLogo from '~/components/logos/mcp.svg';
import GithubLogo from '~/components/logos/github.svg';
import { Button } from '~/components/ui/button';
import { DatePicker } from '~/components/ui/date-picker';
import { AboutPopup } from '~/components/about';
import { ServerCard } from './components/server-card';
import { Spinner } from './components/ui/spinner';
import type {
  IdeConfigPkg,
  IdeConfigRemote,
  IdeConfig,
  McpServerItem,
  McpServerPkg,
  McpServerRemote,
  StackItem,
  StackCtrl,
} from '~/lib/types';
// import { initOrama, queryOrama, upsertServers } from '~/lib/orama';

// TODO: http://localhost:5173/server/ai.alpic.test/test-mcp-server
// Many remote servers ~page 5:
// com.cloudflare.mcp/mcp
// app.thoughtspot/mcp-server
// Pkg with runtime args: com.supabase/mcp
// Many env vars in pkg: io.github.CodeLogicIncEngineering/codelogic-mcp-server
// Many packages and remotes:
// co.pipeboard/meta-ads-mcp (1)
// com.driflyte/driflyte-mcp-server
// With websiteUrl: com.epidemicsound/mcp-server

// Empty packages: com.falkordb/QueryWeaver

export default function App() {
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize `search` from the URL query string (if present).
  // Use a lazy initializer and guard window for environments without DOM.
  const [search, setSearch] = useState<string>(() => {
    try {
      if (typeof window === 'undefined') return '';
      const params = new URLSearchParams(window.location.search);
      return params.get('search') || '';
    } catch {
      return '';
    }
  });

  // Keep the URL query string in sync with `search` (debounced, replaceState so we don't clutter history)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let mounted = true;
    const handler = setTimeout(() => {
      if (!mounted) return;
      try {
        const params = new URLSearchParams(window.location.search);
        if (search) {
          params.set('search', search);
        } else {
          params.delete('search');
        }
        const query = params.toString();
        const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        window.history.replaceState(null, '', newUrl);
      } catch {
        // ignore
      }
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(handler);
    };
  }, [search]);

  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [resultsPerPage, setResultsPerPage] = useState(60);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  // Map page number -> cursor needed to fetch that page (page 1 => null)
  const [pageCursors, setPageCursors] = useState<Record<number, string | null>>({ 1: null });

  // Initialize apiUrl with default value
  const [registryUrl, setRegistryUrl] = useState('https://registry.modelcontextprotocol.io/v0/servers');

  // Initialize stack from localStorage (client-side only) to avoid race
  // where the "save" effect would run on mount and overwrite a loaded value.
  const [stack, setStack] = useState<StackItem[]>(() => {
    try {
      if (typeof window === 'undefined') return [];
      const saved = localStorage.getItem('mcp-registry-stack');
      return saved ? (JSON.parse(saved) as StackItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // Load from localStorage after component mounts (client-side only)
    const savedApiUrl = localStorage.getItem('mcp-registry-api-url');
    if (savedApiUrl) setRegistryUrl(savedApiUrl);
    const savedResultsPerPage = localStorage.getItem('mcp-registry-results-per-page');
    if (savedResultsPerPage) {
      const parsed = parseInt(savedResultsPerPage, 10);
      if (parsed >= 3 && parsed <= 100) {
        setResultsPerPage(parsed);
      }
    }
    // Listen to back/forward navigation and sync `search` with the URL
    if (typeof window === 'undefined') return;
    const onPop = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        setSearch(params.get('search') || '');
      } catch {
        // ignore
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Save apiUrl to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp-registry-api-url', registryUrl);
  }, [registryUrl]);

  // Save resultsPerPage to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp-registry-results-per-page', resultsPerPage.toString());
  }, [resultsPerPage]);

  // Save stack to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp-registry-stack', JSON.stringify(stack));
  }, [stack]);

  /** Bundle stack manipulation functions to avoid re-defining them inline in props */
  const stackCtrl: StackCtrl = {
    getFromStack: (serverName: string, type: 'remote' | 'package', index: number): StackItem | null => {
      const found = stack.find((item) => item.serverName === serverName && item.type === type && item.index === index);
      return found || null;
    },
    addToStack: (
      serverName: string,
      type: 'remote' | 'package',
      data: McpServerPkg | McpServerRemote,
      index: number,
      ideConfig?: IdeConfig
    ) => {
      const existingItem = stack.find(
        (item) => item.serverName === serverName && item.type === type && item.index === index
      );
      if (existingItem) {
        // If an ideConfig is provided, update the existing item's config
        if (ideConfig) {
          setStack((prev) =>
            prev.map((it) =>
              it.serverName === serverName && it.type === type && it.index === index ? { ...it, ideConfig } : it
            )
          );
        }
        return;
      }
      setStack((prev) => [...prev, { serverName, type, data, index, ideConfig }]);
    },
    removeFromStack: (serverName: string, type: 'remote' | 'package', index: number) => {
      setStack(stack.filter((item) => !(item.serverName === serverName && item.type === type && item.index === index)));
    },
  };

  /** Check if server has any items in stack */
  const serverHasItemsInStack = (serverName: string) => {
    return stack.some((item) => item.serverName === serverName);
  };

  /** Generate config for all stack items */
  const generateStackConfig = (configType: 'vscode' | 'cursor') => {
    const servers: { [key: string]: IdeConfigPkg | IdeConfigRemote } = {};
    stack.forEach((item) => {
      // Prefer the user-filled ideConfig saved on the stack item; fall back to computed defaults
      if (item.ideConfig) {
        servers[item.serverName] = item.ideConfig as IdeConfigPkg | IdeConfigRemote;
      } else {
        servers[item.serverName] =
          item.type === 'remote'
            ? buildIdeConfigForRemote(item.data as McpServerRemote)
            : buildIdeConfigForPkg(item.data as McpServerPkg);
      }
    });
    if (configType === 'vscode') {
      return JSON.stringify({ servers }, null, 2);
    } else {
      return JSON.stringify({ mcpServers: servers }, null, 2);
    }
  };

  /** Download `mcp.json` config file */
  const downloadMcpJsonConfig = (configType: 'vscode' | 'cursor') => {
    const config = generateStackConfig(configType);
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcp.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** Fetch servers from the API */
  const fetchServers = useCallback(
    async (searchQuery = '', cursor: string | null = null, dateFilter?: Date) => {
      setLoading(true);
      setError(null);
      try {
        // Build the API URL first with all parameters
        let baseUrl = registryUrl;
        const params = ['version=latest', `limit=${resultsPerPage}`];
        if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
        if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
        if (dateFilter) {
          // Format date as RFC3339 datetime
          const rfc3339Date = dateFilter.toISOString();
          params.push(`updated_since=${encodeURIComponent(rfc3339Date)}`);
        }
        if (params.length > 0) {
          baseUrl += `?${params.join('&')}`;
        }
        // Then wrap it with the CORS proxy
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(baseUrl)}`;
        console.log('Fetching URL:', proxyUrl);
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: { Accept: 'application/json, application/problem+json' },
          cache: 'force-cache' as const,
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log('Fetched data:', data);
        setServers(data.servers || []);
        setNextCursor(data.metadata?.nextCursor || null);
        // // Try to upsert into Orama for local search indexing (fail silently)
        // try {
        //   if (data?.servers && data.servers.length > 0) {
        //     await upsertServers(data.servers);
        //   }
        // } catch (e) {
        //   // ignore
        // }
        // if (searchQuery) {
        //   const searchRes = queryOrama(searchQuery);
        //   console.log('Orama search results:', searchRes);
        // }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [registryUrl, resultsPerPage]
  );

  // Fetch servers when search, apiUrl, filterDate, or resultsPerPage changes
  useEffect(() => {
    setCurrentCursor(null);
    setPreviousCursors([]);
    setNextCursor(null);
    setCurrentPage(1);
    // Reset page cursor map for the new search / filters / settings.
    setPageCursors({ 1: null });
    fetchServers(search, null, filterDate);
  }, [search, registryUrl, filterDate, resultsPerPage, fetchServers]);

  // // Initialize Orama (client-side) on mount
  // useEffect(() => {
  //   let mounted = true;
  //   (async () => {
  //     try {
  //       if (typeof window === 'undefined') return;
  //       await initOrama();
  //       if (!mounted) return;
  //     } catch (err) {
  //       // ignore
  //     }
  //   })();
  //   return () => {
  //     mounted = false;
  //   };
  // }, []);

  const handleNext = () => {
    if (nextCursor) {
      // Store the cursor for the next page so we can jump back to it later
      setPageCursors((prev) => ({ ...prev, [currentPage + 1]: nextCursor }));
      setPreviousCursors((prev) => [...prev, currentCursor || '']);
      setCurrentCursor(nextCursor);
      setCurrentPage((prev) => prev + 1);
      fetchServers(search, nextCursor, filterDate);
    }
  };

  const handlePrevious = () => {
    if (previousCursors.length > 0) {
      const prevCursor = previousCursors[previousCursors.length - 1];
      setPreviousCursors((prev) => prev.slice(0, -1));
      setCurrentCursor(prevCursor === '' ? null : prevCursor);
      setCurrentPage((prev) => prev - 1);
      fetchServers(search, prevCursor === '' ? null : prevCursor, filterDate);
    }
  };

  // NOTE: For cursor-based pagination, we can't jump to arbitrary pages, we can only navigate sequentially
  const handleGoToPage = (page: number) => {
    if (page === currentPage) return;

    // If user requests page 1, reset to initial state
    if (page === 1) {
      setCurrentCursor(null);
      setPreviousCursors([]);
      setCurrentPage(1);
      fetchServers(search, null, filterDate);
      return;
    }

    // If we have stored the cursor for the requested page, use it
    const cursorForPage = pageCursors[page];
    if (typeof cursorForPage !== 'undefined') {
      // Rebuild the previousCursors array up to (but not including) the target page
      const newPrevious: string[] = [];
      for (let p = 1; p < page; p++) {
        const c = pageCursors[p];
        newPrevious.push(c === null || typeof c === 'undefined' ? '' : c);
      }
      setPreviousCursors(newPrevious.slice(0, -1));
      setCurrentCursor(cursorForPage);
      setCurrentPage(page);
      fetchServers(search, cursorForPage, filterDate);
      return;
    }

    // If the requested page is the immediate next one and we have a nextCursor, fall back to sequential navigation
    if (page === currentPage + 1 && nextCursor) {
      handleNext();
    }
  };

  const hasPrevious = previousCursors.length > 0;
  const hasNext = nextCursor !== null;

  // Compute list of visited pages (for which we stored cursors)
  const visitedPages = Object.keys(pageCursors)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);
  const lastVisitedPage = visitedPages.length ? visitedPages[visitedPages.length - 1] : 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-col sm:flex-row sm:h-16 items-start sm:items-center justify-between gap-3 sm:gap-0 px-4 py-3 sm:py-0 mx-auto max-w-7xl">
          <div
            role="button"
            tabIndex={0}
            aria-label="Clear search"
            onClick={() => setSearch('')}
            className="flex items-center gap-2 flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <img src={McpLogo} alt="MCP logo" className="h-5 w-5 [filter:invert(0)] dark:[filter:invert(1)]" />
            <h1 className="text-lg">MCP Registry</h1>
          </div>
          <div className="flex items-center gap-4 flex-1 w-full sm:w-auto justify-end max-w-2xl">
            {/* Change the registry API URL input */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Unplug className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Registry API URL"
                    value={registryUrl}
                    onChange={(e) => setRegistryUrl(e.target.value)}
                    className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Change the URL of the MCP registry used</p>
              </TooltipContent>
            </Tooltip>
            <nav className="flex items-center gap-4 flex-shrink-0">
              {/* Stack Dropdown */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button className="relative" variant="ghost">
                        <Server className="h-5 w-5" />
                        {stack.length > 0 && (
                          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {stack.length}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stack of {stack.length} MCP servers</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-80">
                  {stack.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Your stack is empty</div>
                  ) : (
                    <>
                      <div className="max-h-96 overflow-y-auto">
                        {stack.map((item, idx) => (
                          // List servers in the stack, with remove button
                          <DropdownMenuItem
                            key={idx}
                            className="flex items-center justify-between gap-2 p-3 cursor-pointer"
                            onSelect={(e) => e.preventDefault()}
                            onClick={() => setSearch(item.serverName)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs truncate">{item.serverName}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {item.type === 'package' && 'registryType' in item.data && 'identifier' in item.data
                                  ? `${item.data.registryType}: ${item.data.identifier}`
                                  : `Remote: ${'url' in item.data ? item.data.url : ''}`}
                              </div>
                            </div>
                            <Button
                              variant="link"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                stackCtrl.removeFromStack(item.serverName, item.type, item.index);
                              }}
                              className="p-1 hover:bg-destructive/10 rounded transition-colors"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </DropdownMenuItem>
                        ))}
                      </div>
                      {/* Download stack config dropdown */}
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <DropdownMenuItem
                          onClick={() => downloadMcpJsonConfig('vscode')}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                          <img src={VscodeLogo} alt="VSCode" className="h-4 w-4" />
                          Download VSCode <code>mcp.json</code>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => downloadMcpJsonConfig('cursor')}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                          <img
                            src={CursorLogo}
                            alt="Cursor"
                            className="h-4 w-4 [filter:invert(0)] dark:[filter:invert(1)]"
                          />
                          Download Cursor <code>mcp.json</code>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setStack([])}
                          className="flex items-center gap-2 cursor-pointer text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Clear Stack
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* About popup and theme toggle */}
              <AboutPopup />
              <ThemeToggle />
              {/* GitHub link */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com/vemonet/mcp-registry"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <img
                      src={GithubLogo}
                      alt="GitHub"
                      className="h-5 w-5  [filter:invert(0)] dark:[filter:invert(0.6)]"
                    />
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    <a
                      href="https://github.com/vemonet/mcp-registry"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-muted-foreground"
                    >
                      🔗 github.com/vemonet/mcp-registry
                    </a>
                  </p>
                </TooltipContent>
              </Tooltip>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-2 py-4 mx-auto max-w-7xl">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
          {/* Search Bar */}
          <div className="w-full max-w-2xl mt-2">
            <div className="relative flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search MCP servers by name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-10 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              {/* Filter Date Button */}
              <DatePicker
                date={filterDate}
                onDateChange={setFilterDate}
                placeholder="Filter by date"
                variant={filterDate ? 'default' : 'outline'}
                className="h-auto py-3 px-4"
              />
              {/* Results Per Page Selector */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-auto py-3 px-4 gap-2">
                        <span className="text-sm">{servers.length}</span>
                        <span className="text-xs text-muted-foreground">servers</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of servers per page</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  {[3, 15, 30, 45, 60, 75, 90, 100].map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => setResultsPerPage(size)}
                      className={`cursor-pointer ${resultsPerPage === size ? 'bg-accent' : ''}`}
                    >
                      {size}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Loading/Error States */}
        {loading && (
          <p className="flex mt-4 items-center justify-center text-center text-muted-foreground gap-2">
            <Spinner />
            <span>Loading servers...</span>
          </p>
        )}
        {error && <p className="text-center text-red-500">Error: {error}</p>}

        {/* Server Cards Grid */}
        {!loading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {servers.map((item, index) => (
                <Card
                  key={`${item.server.name}-${index}`}
                  className={`hover:shadow-lg transition-shadow ${
                    serverHasItemsInStack(item.server.name)
                      ? 'bg-green-100 dark:bg-green-950/40 border-green-200 dark:border-green-900'
                      : ''
                  }`}
                >
                  {/* MCP Server card to display a server */}
                  <ServerCard
                    item={item}
                    registryUrl={registryUrl}
                    stackCtrl={stackCtrl}
                    // addToStack={addToStack}
                    // removeFromStack={removeFromStack}
                    // getFromStack={getFromStack}
                  />
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {(hasPrevious || hasNext || lastVisitedPage > 1) && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={handlePrevious}
                      className={!hasPrevious ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {/* Render visited page numbers (we only allow jumping to pages we have a cursor for) */}
                  {Array.from({ length: lastVisitedPage }, (_, i) => i + 1).map((pageNum) => (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => handleGoToPage(pageNum)}
                        className={pageNum === currentPage ? 'pointer-events-none' : 'cursor-pointer'}
                        isActive={pageNum === currentPage}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  {/* If there's a next page that we haven't stored yet, show the next page number and allow sequential next */}
                  {hasNext && !pageCursors[lastVisitedPage + 1] && (
                    <PaginationItem>
                      <PaginationLink onClick={handleNext} className="cursor-pointer">
                        {lastVisitedPage + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={handleNext}
                      className={!hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </main>
    </div>
  );
}
