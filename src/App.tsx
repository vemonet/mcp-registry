import { useState, useEffect, useCallback } from 'react';
import { Search, Unplug, Server, Trash2, Download } from 'lucide-react';

import { buildIdeConfigForPkg, buildIdeConfigForRemote } from '~/lib/ide-config';
import { Card } from '~/components/ui/card';
import { ThemeToggle } from '~/components/theme-toggle';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
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
import { DatePicker } from '~/components/date-picker';
import { AboutPopup } from '~/components/about';
import type { ServerItem, StackItem } from '~/lib/types';
import { ServerCard } from './components/server-card';
import { Spinner } from './components/ui/spinner';

// TODO: http://localhost:5173/server/ai.alpic.test/test-mcp-server
// Many remote servers ~page 5:
// com.cloudflare.mcp/mcp
// app.thoughtspot/mcp-server
// Many packages and remotes:
// co.pipeboard/meta-ads-mcp (1)
// com.driflyte/driflyte-mcp-server

// Empty packages: com.falkordb/QueryWeaver

export default function App() {
  const [servers, setServers] = useState<ServerItem[]>([]);
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

  // Initialize apiUrl with default value
  const [apiUrl, setApiUrl] = useState('https://registry.modelcontextprotocol.io/v0/servers');

  // Initialize stack with empty array
  const [stack, setStack] = useState<StackItem[]>([]);

  useEffect(() => {
    // Load from localStorage after component mounts (client-side only)
    const savedApiUrl = localStorage.getItem('mcp-registry-api-url');
    if (savedApiUrl) setApiUrl(savedApiUrl);
    const savedResultsPerPage = localStorage.getItem('mcp-registry-results-per-page');
    if (savedResultsPerPage) {
      const parsed = parseInt(savedResultsPerPage, 10);
      if (parsed >= 3 && parsed <= 100) {
        setResultsPerPage(parsed);
      }
    }
    const savedStack = localStorage.getItem('mcp-registry-stack');
    if (savedStack) {
      try {
        setStack(JSON.parse(savedStack));
      } catch (err) {
        console.error('Failed to parse saved stack:', err);
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
    localStorage.setItem('mcp-registry-api-url', apiUrl);
  }, [apiUrl]);

  // Save resultsPerPage to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp-registry-results-per-page', resultsPerPage.toString());
  }, [resultsPerPage]);

  // Save stack to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp-registry-stack', JSON.stringify(stack));
  }, [stack]);

  const addToStack = (serverName: string, type: 'remote' | 'package', data: any, index: number) => {
    // const stackKey = `${serverName}-${type}-${index}`;
    const existingItem = stack.find(
      (item) => item.serverName === serverName && item.type === type && item.index === index
    );
    if (!existingItem) {
      setStack([...stack, { serverName, type, data, index }]);
    }
  };

  /** Remove item from stack */
  const removeFromStack = (serverName: string, type: 'remote' | 'package', index: number) => {
    setStack(stack.filter((item) => !(item.serverName === serverName && item.type === type && item.index === index)));
  };

  /** Check if item is in stack */
  const isInStack = (serverName: string, type: 'remote' | 'package', index: number) => {
    return stack.some((item) => item.serverName === serverName && item.type === type && item.index === index);
  };

  /** Check if server has any items in stack */
  const serverHasItemsInStack = (serverName: string) => {
    return stack.some((item) => item.serverName === serverName);
  };

  /** Generate config for all stack items */
  const generateStackConfig = (configType: 'vscode' | 'cursor') => {
    const servers: any = {};
    stack.forEach((item) => {
      const config =
        item.type === 'remote'
          ? buildIdeConfigForRemote(item.serverName, item.data)
          : buildIdeConfigForPkg(item.serverName, item.data);
      Object.assign(servers, config);
    });
    if (configType === 'vscode') {
      return JSON.stringify({ servers }, null, 2);
    } else {
      return JSON.stringify({ mcpServers: servers }, null, 2);
    }
  };

  /** Download config file */
  const downloadConfig = (configType: 'vscode' | 'cursor') => {
    const config = generateStackConfig(configType);
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = configType === 'vscode' ? 'mcp-settings.json' : 'cursor-config.json';
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
        let baseUrl = apiUrl;
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
        const url = `https://corsproxy.io/?url=${encodeURIComponent(baseUrl)}`;
        console.log('Fetching URL:', url);
        const options = {
          method: 'GET',
          headers: { Accept: 'application/json, application/problem+json' },
          cache: 'force-cache' as const,
        };
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched data:', data);
        setServers(data.servers || []);
        setNextCursor(data.metadata?.nextCursor || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, resultsPerPage]
  );

  // Fetch servers when search, apiUrl, filterDate, or resultsPerPage changes
  useEffect(() => {
    setCurrentCursor(null);
    setPreviousCursors([]);
    setNextCursor(null);
    setCurrentPage(1);
    fetchServers(search, null, filterDate);
    // // Update URL parameter
    // if (search) {
    //   setSearchParams({ search });
    // } else {
    //   setSearchParams({});
    // }
  }, [search, apiUrl, filterDate, resultsPerPage, fetchServers]);

  const handleNext = () => {
    if (nextCursor) {
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

  // NOTE: For cursor-based pagination, we can't jump to arbitrary pages
  // We can only navigate sequentially
  const handleGoToPage = (page: number) => {
    if (page === 1) {
      // Go to first page
      setCurrentCursor(null);
      setPreviousCursors([]);
      setCurrentPage(1);
      fetchServers(search, null, filterDate);
    }
  };

  const hasPrevious = previousCursors.length > 0;
  const hasNext = nextCursor !== null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-col sm:flex-row sm:h-16 items-start sm:items-center justify-between gap-3 sm:gap-0 px-4 py-3 sm:py-0 mx-auto max-w-7xl">
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src={McpLogo} alt="Cursor" className="h-5 w-5 [filter:invert(0)] dark:[filter:invert(1)]" />
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
                    placeholder="API URL"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
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
                    <p>Stack ({stack.length} items)</p>
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
                            className="flex items-center justify-between gap-2 p-3"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs truncate">{item.serverName}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {item.type === 'package'
                                  ? `${item.data.registryType}: ${item.data.identifier}`
                                  : `Remote: ${item.data.url}`}
                              </div>
                            </div>
                            <button
                              onClick={() => removeFromStack(item.serverName, item.type, item.index)}
                              className="p-1 hover:bg-destructive/10 rounded transition-colors"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </DropdownMenuItem>
                        ))}
                      </div>
                      {/* Download stack config dropdown */}
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <DropdownMenuItem
                          onClick={() => downloadConfig('vscode')}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                          <img src={VscodeLogo} alt="VSCode" className="h-4 w-4" />
                          Download VSCode <code>mcp.json</code>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => downloadConfig('cursor')}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                          <img
                            src={CursorLogo}
                            alt="Cursor"
                            className="h-4 w-4 [filter:invert(0)] dark:[filter:invert(1)]"
                          />
                          Download Cursor config
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
                    <a href="https://github.com/vemonet/mcp-registry" target="_blank" rel="noopener noreferrer">
                      https://github.com/vemonet/mcp-registry
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
                  placeholder="Search MCP servers by name..."
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
                        <span className="text-sm">{resultsPerPage}</span>
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
          <p className="flex items-center justify-center text-center text-muted-foreground gap-2">
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
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                      : ''
                  }`}
                >
                  {/* MCP Server card to display a server */}
                  <ServerCard item={item} addToStack={addToStack} isInStack={isInStack} />
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {(hasPrevious || hasNext) && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={handlePrevious}
                      className={!hasPrevious ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {/* First page */}
                  {currentPage > 1 && (
                    <PaginationItem>
                      <PaginationLink onClick={() => handleGoToPage(1)} className="cursor-pointer">
                        1
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  {/* Ellipsis before current page range */}
                  {currentPage > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  {/* Previous page */}
                  {currentPage > 2 && (
                    <PaginationItem>
                      <PaginationLink className="pointer-events-none opacity-50">{currentPage - 1}</PaginationLink>
                    </PaginationItem>
                  )}
                  {/* Current page */}
                  <PaginationItem>
                    <PaginationLink isActive className="pointer-events-none">
                      {currentPage}
                    </PaginationLink>
                  </PaginationItem>
                  {/* Next page indicator (if there is a next page) */}
                  {hasNext && (
                    <PaginationItem>
                      <PaginationLink className="pointer-events-none opacity-50">{currentPage + 1}</PaginationLink>
                    </PaginationItem>
                  )}
                  {/* Ellipsis after current page (if there's more) */}
                  {hasNext && (
                    <PaginationItem>
                      <PaginationEllipsis />
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
