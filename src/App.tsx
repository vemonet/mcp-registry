import { useState, useEffect, useCallback } from 'react';
// import { useSearchParams } from 'react-router';
import {
  Search,
  Link2,
  Copy,
  CheckCircle2,
  HardDriveUpload,
  Rss,
  Plug,
  Unplug,
  Package,
  CheckCircle,
  XCircle,
  Calendar,
  Server,
  Plus,
  Trash2,
  Download,
  Container,
  Settings,
} from 'lucide-react';

import {
  buildIdeConfigForPkg,
  buildIdeConfigForRemote,
  genCursorConfigForPkg,
  genCursorConfigForRemote,
  genVscodeConfigForPkg,
  genVscodeConfigForRemote,
} from '~/lib/ide-config';
import { formatDate } from '~/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
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
import PypiLogo from '~/components/logos/pypi-logo.svg';
import NpmLogo from '~/components/logos/npm-logo.svg';
import VscodeLogo from '~/components/logos/vscode-logo.svg';
import CursorLogo from '~/components/logos/cursor-logo.svg';
import McpLogo from '~/components/logos/mcp.svg';
import GithubLogo from '~/components/logos/github.svg';
import { Button } from '~/components/ui/button';
import { DatePicker } from '~/components/date-picker';
import { AboutPopup } from '~/components/about';
import type { ServerItem, ServerPackage, StackItem } from '~/lib/types';

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
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
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
        {loading && <p className="text-center">Loading servers...</p>}
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
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-md break-words mb-2">{item.server.name}</CardTitle>
                        <div className="flex items-center gap-2 mb-1">
                          {/* Status indicator */}
                          {item._meta?.['io.modelcontextprotocol.registry/official']?.status && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex-shrink-0">
                                  {item._meta['io.modelcontextprotocol.registry/official'].status === 'active' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Status: {item._meta['io.modelcontextprotocol.registry/official'].status}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {/* Version badge */}
                          {item.server.version && (
                            <Badge variant="secondary" className="text-xs">
                              v{item.server.version}
                            </Badge>
                          )}
                          {/* Date information */}
                          {item._meta?.['io.modelcontextprotocol.registry/official']?.publishedAt && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Calendar className="h-4 w-4" />
                                  <span className="text-xs text-muted-foreground">
                                    {(() => {
                                      const date = new Date(
                                        item._meta['io.modelcontextprotocol.registry/official'].updatedAt ||
                                          item._meta['io.modelcontextprotocol.registry/official'].publishedAt
                                      );
                                      return formatDate(date);
                                    })()}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Published at{' '}
                                  {new Date(
                                    item._meta['io.modelcontextprotocol.registry/official'].publishedAt
                                  ).toLocaleString('fr-FR')}
                                </p>
                                {item._meta?.['io.modelcontextprotocol.registry/official']?.updatedAt && (
                                  <p>
                                    Updated at{' '}
                                    {new Date(
                                      item._meta['io.modelcontextprotocol.registry/official'].updatedAt
                                    ).toLocaleString('fr-FR')}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {/* Repository/Source Code Link */}
                          {item.server.repository?.url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={item.server.repository.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 p-1 rounded-md hover:bg-accent transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {item.server.repository.source === 'github' ? (
                                    <img
                                      src={GithubLogo}
                                      alt="GitHub"
                                      className="h-4 w-4  [filter:invert(0)] dark:[filter:invert(0.6)]"
                                    />
                                  ) : (
                                    <Link2 className="h-4 w-4" />
                                  )}
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  <a target="_blank" rel="noopener noreferrer" href={item.server.repository.url}>
                                    {item.server.repository.url}
                                  </a>
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <CardDescription className="mt-2">{item.server.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {(item.server.remotes && item.server.remotes.length > 0) ||
                  (item.server.packages && item.server.packages.length > 0) ? (
                    <CardContent className="pt-0 space-y-2">
                      {/* Packages Section */}
                      {item.server.packages && item.server.packages.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-md border border-muted">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Packages</p>
                            </TooltipContent>
                          </Tooltip>
                          {/* Get package URL */}
                          {item.server.packages.map((pkg, pkgIndex) => {
                            const packageUrl =
                              pkg.registryType === 'npm'
                                ? `https://www.npmjs.com/package/${pkg.identifier}`
                                : pkg.registryType === 'pypi'
                                  ? `https://pypi.org/project/${pkg.identifier}/`
                                  : pkg.registryType === 'oci' || pkg.registryType === 'docker'
                                    ? `https://hub.docker.com/r/${pkg.identifier}`
                                    : null;

                            return (
                              <DropdownMenu key={pkgIndex}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent transition-colors cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {getPackageIcon(pkg)}
                                        <span className="font-medium">{pkg.identifier}</span>
                                        {pkg.environmentVariables &&
                                          Object.keys(pkg.environmentVariables).length > 0 && (
                                            <Settings className="h-3 w-3 text-blue-300 flex-shrink-0" />
                                          )}
                                      </button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {/* Tooltip of package */}
                                    <p>
                                      📦 Type: <code>{pkg.registryType}</code>
                                    </p>
                                    {pkg.registryBaseUrl && (
                                      <p>
                                        📘 Registry:{' '}
                                        <a href={pkg.registryBaseUrl} target="_blank" rel="noopener noreferrer">
                                          {pkg.registryBaseUrl}
                                        </a>
                                      </p>
                                    )}
                                    <p>
                                      🏷️ Version: <code>{pkg.version}</code>
                                    </p>
                                    {pkg.runtimeHint && (
                                      <p>
                                        💡 Runtime Hint: <code>{pkg.runtimeHint}</code>
                                      </p>
                                    )}
                                    {pkg.environmentVariables && pkg.environmentVariables.length > 0 && (
                                      <div className="mt-2">
                                        ⚙️ Environment Variables:
                                        <div className="mt-1 space-y-1">
                                          {pkg.environmentVariables.map((envVar) => (
                                            <div key={envVar.name} className="text-xs">
                                              <div className="flex items-center gap-1">
                                                <code>{envVar.name}</code>
                                                {envVar.isRequired && <span className="text-red-500 text-xs">*</span>}
                                                {envVar.isSecret && <span className="text-orange-500 text-xs">🔒</span>}
                                              </div>
                                              {envVar.description && (
                                                <div className="text-muted-foreground ml-2">{envVar.description}</div>
                                              )}
                                              {envVar.default && (
                                                <div className="text-muted-foreground ml-2">
                                                  Default: <code>{envVar.default}</code>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {pkg.runtimeArguments && pkg.runtimeArguments.length > 0 && (
                                      <div className="mt-2">
                                        ⚡ Runtime Arguments:
                                        <div className="mt-1 space-y-1">
                                          {pkg.runtimeArguments.map((arg, argIndex) => (
                                            <div key={argIndex} className="text-xs">
                                              <div className="flex items-center gap-1">
                                                {arg.type === 'named' ? (
                                                  <>
                                                    <code className="ml-2">{arg.name}</code>
                                                    <Badge variant="outline" className="text-xs px-1 py-0">
                                                      named
                                                    </Badge>
                                                  </>
                                                ) : (
                                                  <>
                                                    <code className="ml-2">{arg.value}</code>
                                                    <Badge variant="outline" className="text-xs px-1 py-0">
                                                      positional
                                                    </Badge>
                                                  </>
                                                )}
                                                {arg.description && (
                                                  <span className="text-muted-foreground ml-2">{arg.description}</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem
                                    onClick={() => addToStack(item.server.name, 'package', pkg, pkgIndex)}
                                    className="flex items-center gap-2"
                                    disabled={isInStack(item.server.name, 'package', pkgIndex)}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    {isInStack(item.server.name, 'package', pkgIndex)
                                      ? 'In your Stack'
                                      : 'Add to your Stack'}
                                  </DropdownMenuItem>
                                  {packageUrl && (
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={packageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2"
                                      >
                                        <Link2 className="h-3.5 w-3.5" />
                                        View Package
                                      </a>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => copyToClipboard(pkg.identifier)}
                                    className="flex items-center gap-2"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy Package Name
                                  </DropdownMenuItem>
                                  {/* https://code.visualstudio.com/api/extension-guides/ai/mcp#create-an-mcp-installation-url */}
                                  <DropdownMenuItem asChild>
                                    <a
                                      href={`vscode:mcp/install?${encodeURIComponent(
                                        JSON.stringify({
                                          name: item.server.name,
                                          ...buildIdeConfigForPkg(item.server.name, pkg)[item.server.name],
                                        })
                                      )}`}
                                      className="flex items-center gap-2"
                                    >
                                      <img src={VscodeLogo} alt="VSCode" className="h-3.5 w-3.5" />
                                      Install in VSCode
                                    </a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => copyToClipboard(genVscodeConfigForPkg(item.server.name, pkg))}
                                    className="flex items-center gap-2"
                                  >
                                    <img src={VscodeLogo} alt="Cursor" className="h-3.5 w-3.5" />
                                    Copy VSCode config
                                  </DropdownMenuItem>
                                  {/* https://cursor.com/docs/context/mcp/install-links */}
                                  <DropdownMenuItem asChild>
                                    <a
                                      href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${item.server.name}&config=${encodeURIComponent(JSON.stringify(buildIdeConfigForPkg(item.server.name, pkg)[item.server.name]))}`}
                                      className="flex items-center gap-2"
                                    >
                                      <img
                                        src={CursorLogo}
                                        alt="Cursor"
                                        className="h-3.5 w-3.5 [filter:invert(0)] dark:[filter:invert(1)]"
                                      />
                                      Install in Cursor
                                    </a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => copyToClipboard(genCursorConfigForPkg(item.server.name, pkg))}
                                    className="flex items-center gap-2"
                                  >
                                    <img
                                      src={CursorLogo}
                                      alt="Cursor"
                                      className="h-3.5 w-3.5 [filter:invert(0)] dark:[filter:invert(1)]"
                                    />
                                    Copy Cursor config
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })}
                        </div>
                      )}

                      {/* Remote Servers Section */}
                      {item.server.remotes && item.server.remotes.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-md border border-muted">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center">
                                <Plug className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remote Servers</p>
                            </TooltipContent>
                          </Tooltip>
                          {item.server.remotes.map((remote, remoteIndex) => (
                            <DropdownMenu key={remoteIndex}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent transition-colors cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {remote.type === 'sse' ? (
                                        <HardDriveUpload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      ) : remote.type.includes('http') ? (
                                        <Rss className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      )}
                                      <span className="break-all font-mono">{remote.url}</span>
                                      {remote.headers && Object.keys(remote.headers).length > 0 && (
                                        <Settings className="h-3 w-3 text-blue-300 flex-shrink-0" />
                                      )}
                                      {copiedUrl === remote.url && (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                      )}
                                    </button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  {/* Tooltip to display remote server details */}
                                  <div className="space-y-2">
                                    <p>
                                      🚛 Transport: <code>{remote.type}</code>
                                    </p>
                                    {remote.headers && (
                                      <div>
                                        ⚙️ Headers:
                                        <div className="mt-1 space-y-1">
                                          {Object.entries(remote.headers).map(([key, header]) => (
                                            <div key={key} className="text-xs">
                                              <div className="flex items-center gap-1">
                                                <code>{typeof header === 'string' ? key : header.name}</code>
                                                {typeof header === 'object' && header.isRequired && (
                                                  <span className="text-red-500 text-xs">*</span>
                                                )}
                                                {typeof header === 'object' && header.isSecret && (
                                                  <span className="text-orange-500 text-xs">🔒</span>
                                                )}
                                              </div>
                                              {typeof header === 'object' && header.description && (
                                                <div className="text-muted-foreground ml-2">{header.description}</div>
                                              )}
                                              {typeof header === 'object' && header.default && (
                                                <div className="text-muted-foreground ml-2">
                                                  Default: <code>{header.default}</code>
                                                </div>
                                              )}
                                              {typeof header === 'string' && (
                                                <div className="text-muted-foreground ml-2">
                                                  <code>{header}</code>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                  onClick={() => addToStack(item.server.name, 'remote', remote, remoteIndex)}
                                  className="flex items-center gap-2"
                                  disabled={isInStack(item.server.name, 'remote', remoteIndex)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  {isInStack(item.server.name, 'remote', remoteIndex)
                                    ? 'In your Stack'
                                    : 'Add to your Stack'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => copyToClipboard(remote.url)}
                                  className="flex items-center gap-2"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy Server URL
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`vscode:mcp/install?${encodeURIComponent(
                                      JSON.stringify({
                                        name: item.server.name,
                                        ...buildIdeConfigForRemote(item.server.name, remote)[item.server.name],
                                      })
                                    )}`}
                                    className="flex items-center gap-2"
                                  >
                                    <img src={VscodeLogo} alt="VSCode" className="h-3.5 w-3.5" />
                                    Install in VSCode
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => copyToClipboard(genVscodeConfigForRemote(item.server.name, remote))}
                                  className="flex items-center gap-2"
                                >
                                  <img src={VscodeLogo} alt="VSCode" className="h-3.5 w-3.5" />
                                  Copy VSCode config
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${item.server.name}&config=${encodeURIComponent(JSON.stringify(buildIdeConfigForRemote(item.server.name, remote)[item.server.name]))}`}
                                    className="flex items-center gap-2"
                                  >
                                    <img
                                      src={CursorLogo}
                                      alt="Cursor"
                                      className="h-3.5 w-3.5 [filter:invert(0)] dark:[filter:invert(1)]"
                                    />
                                    Install in Cursor
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => copyToClipboard(genCursorConfigForRemote(item.server.name, remote))}
                                  className="flex items-center gap-2"
                                >
                                  <img
                                    src={CursorLogo}
                                    alt="Cursor"
                                    className="h-3.5 w-3.5 [filter:invert(0)] dark:[filter:invert(1)]"
                                  />
                                  Copy Cursor config
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  ) : null}
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

const getPackageIcon = (pkg: ServerPackage) => {
  if (pkg.registryType === 'npm') {
    return <img src={NpmLogo} alt="NPM" className="h-4 w-4" />;
  } else if (pkg.registryType === 'pypi') {
    return <img src={PypiLogo} alt="PyPI" className="h-4 w-4" />;
  } else if (pkg.registryType === 'oci' || pkg.registryType === 'docker') {
    return <Container className="h-4 w-4" />;
  } else {
    return <Package className="h-4 w-4" />;
  }
};
