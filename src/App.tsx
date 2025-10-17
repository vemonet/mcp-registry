import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Unplug, Server, Trash2, Download, CornerDownLeft, Package, Filter } from 'lucide-react';
import PypiLogo from '~/components/logos/pypi.svg';
import NpmLogo from '~/components/logos/npm.svg';
import DockerLogo from '~/components/logos/docker.svg';
import { getRemoteIcon } from './components/server-utils';

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
  DropdownMenuSeparator,
} from '~/components/ui/dropdown-menu';
import { Checkbox } from '~/components/ui/checkbox';
import { Switch } from '~/components/ui/switch';
import VscodeLogo from '~/components/logos/vscode.svg';
import CursorLogo from '~/components/logos/cursor.svg';
import McpLogo from '~/components/logos/mcp.svg';
import GithubLogo from '~/components/logos/github.svg';
import { Button } from '~/components/ui/button';
import { DatePicker } from '~/components/ui/date-picker';
import { AboutPopup } from '~/components/about';
import { ServerCard } from './components/server-card';
import { Spinner } from './components/ui/spinner';
import type { McpIdeConfig, McpServerItem, McpServerPkg, McpServerRemote, StackItem, StackCtrl } from '~/lib/types';
import { idbSearch } from '~/lib/indexeddb';

// NOTE: interesting MCP servers to check
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
  const [registryUrl, setRegistryUrl] = useState('https://registry.modelcontextprotocol.io/v0.1/servers');
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  // Filters for indexed results (visible only when index is enabled)
  const [pkgFilters, setPackageFilters] = useState<Record<string, boolean>>({
    npm: true,
    pypi: true,
    oci: true,
    other: true,
  });
  const [remoteFilters, setRemoteFilters] = useState<Record<string, boolean>>({
    'streamable-http': true,
    sse: true,
  });
  const [resultsPerPage, setResultsPerPage] = useState(60);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  // Map page number -> cursor needed to fetch that page (page 1 => null)
  const [pageCursors, setPageCursors] = useState<Record<number, string | null>>({ 1: null });

  // When using the local index we keep the full search results in a ref so we
  // can perform client-side pagination (offset/limit)
  // The currently-displayed page still lives in `servers`.
  const indexedResultsRef = useRef<McpServerItem[] | null>(null);

  // Helper to change the visible page when using the local index (client-side pagination).
  // Encapsulates computing bounds, slicing the results, and updating pagination cursors.
  const changeIndexedPage = useCallback(
    (newPage: number) => {
      const total = indexedResultsRef.current?.length || 0;
      const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));
      const page = Math.max(1, Math.min(newPage, totalPages));
      setCurrentPage(page);

      if (!indexedResultsRef.current || total === 0) {
        setServers([]);
        setCurrentCursor(`p:${page}`);
        setNextCursor(null);
        return;
      }

      const from = (page - 1) * resultsPerPage;
      const to = from + resultsPerPage;
      setServers(indexedResultsRef.current.slice(from, to));
      setCurrentCursor(`p:${page}`);
      setNextCursor(page < totalPages ? `p:${page + 1}` : null);
    },
    [resultsPerPage]
  );

  // Initialize stack from IndexedDB (client-side only) to avoid race
  // where the "save" effect would run on mount and overwrite a loaded value.
  const [stack, setStack] = useState<StackItem[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Toggle whether to use an indexed DB search (false = direct API)
  const [useIndex, setUseIndex] = useState(false);
  const [initializingIndex, setInitializingIndex] = useState(false);

  const toggleIndex = async (newValue: boolean) => {
    try {
      if (newValue) {
        setInitializingIndex(true);
        await idbSearch.initServers(registryUrl);
      }
    } catch (err) {
      // ignore
    } finally {
      setInitializingIndex(false);
      setUseIndex(newValue);
    }
  };

  useEffect(() => {
    // Initialize IndexedDB and load settings (client-side only)
    (async () => {
      if (typeof window === 'undefined') return;
      try {
        await idbSearch.init();
        // Load persisted "use index" setting
        const savedUseIndex = await idbSearch.get<boolean>('use-index');
        if (typeof savedUseIndex === 'boolean') setUseIndex(savedUseIndex);
        // NOTE: do NOT call initServers here automatically. We only populate the index
        // when the user explicitly enables the toggle in the UI.
        const savedApiUrl = await idbSearch.get<string>('mcp-registry-api-url');
        if (savedApiUrl) setRegistryUrl(savedApiUrl);
        const savedResultsPerPage = await idbSearch.get<string>('results-per-page');
        if (savedResultsPerPage) {
          const parsed = parseInt(savedResultsPerPage, 10);
          if (parsed >= 3 && parsed <= 100) setResultsPerPage(parsed);
        }
        const savedStack = await idbSearch.getStack();
        if (savedStack && Array.isArray(savedStack)) setStack(savedStack);
        doSearch(search);
      } catch (err) {
      } finally {
        setSettingsLoaded(true);
      }
    })();
    // Listen to back/forward navigation and sync `search` with the URL
    if (typeof window === 'undefined') return;
    const onPop = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        setSearch(params.get('search') || '');
      } catch {}
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist useIndex when it changes (after settings loaded)
  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      idbSearch.set('use-index', useIndex).catch(() => {});
    } catch (e) {}
  }, [useIndex, settingsLoaded]);

  // Initialize `search` from the URL query string (if present).
  const [search, setSearch] = useState<string>(() => {
    try {
      if (typeof window === 'undefined') return '';
      return new URLSearchParams(window.location.search).get('search') || '';
    } catch {
      return '';
    }
  });

  // Keep the URL query string in sync with `search` query (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (search) params.set('search', search);
        else params.delete('search');
        const newUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState(null, '', newUrl); // don't clutter history
      } catch {}
    }, 250);
    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Fetch servers when apiUrl, filterDate, or resultsPerPage changes
  useEffect(() => {
    doSearch(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryUrl, filterDate, resultsPerPage]);

  // Save states (stack, registry URL, results per page) to IndexedDB when they change
  useEffect(() => {
    if (!settingsLoaded) return;
    idbSearch.set('mcp-registry-api-url', registryUrl).catch(() => {});
  }, [registryUrl, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    idbSearch.set('results-per-page', resultsPerPage.toString()).catch(() => {});
  }, [resultsPerPage, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    idbSearch.setStack(stack).catch(() => {});
  }, [stack, settingsLoaded]);

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
      ideConfig?: McpIdeConfig
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
    const servers: { [key: string]: McpIdeConfig } = {};
    stack.forEach((item) => {
      // Prefer the user-filled ideConfig saved on the stack item; fall back to computed defaults
      if (item.ideConfig) {
        servers[item.serverName] = item.ideConfig as McpIdeConfig;
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
    async (searchQuery = '', cursor: string | null = null) => {
      setLoading(true);
      setError(null);
      try {
        if (useIndex) {
          // Ensure the index is initialized (initServers called when toggling, but double-check)
          await idbSearch.init();
          // Get all matching results from the index and page them client-side
          let all = await idbSearch.search(searchQuery);
          // Apply client-side filters when using the local index
          const pkgKeys = Object.keys(pkgFilters).filter((k) => pkgFilters[k]);
          const remKeys = Object.keys(remoteFilters).filter((k) => remoteFilters[k]);
          // TODO: move this logic to indexeddb
          if (pkgKeys.length < Object.keys(pkgFilters).length || remKeys.length < Object.keys(remoteFilters).length) {
            all = all.filter((item) => {
              // If server has packages, ensure at least one matches enabled package filters
              if (Array.isArray(item.server.packages) && item.server.packages.length > 0) {
                const hasPkg = item.server.packages.some((p) => {
                  const t = (p.registryType || '').toLowerCase();
                  if (t === 'npm' && pkgFilters.npm) return true;
                  if (t === 'pypi' && pkgFilters.pypi) return true;
                  if (t === 'oci' && pkgFilters.oci) return true;
                  // Treat unknown registry types as "other"
                  if (!['npm', 'pypi', 'oci'].includes(t) && pkgFilters.other) return true;
                  return false;
                });
                if (!hasPkg) return false;
              }

              // If server has remotes, ensure at least one matches enabled remote filters
              if (Array.isArray(item.server.remotes) && item.server.remotes.length > 0) {
                const hasRemote = item.server.remotes.some((r) => {
                  const rt = (r.type || '').toLowerCase();
                  if (rt === 'streamable-http' && remoteFilters['streamable-http']) return true;
                  if (rt === 'sse' && remoteFilters.sse) return true;
                  return false;
                });
                if (!hasRemote) return false;
              }

              return true;
            });
          }

          indexedResultsRef.current = all;
          const total = indexedResultsRef.current.length;
          const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));

          // Ensure currentPage is within bounds (if it was changed elsewhere)
          if (currentPage > totalPages) setCurrentPage(totalPages);

          // Build a mapping of page -> synthetic cursor so the existing pagination
          // UI can render page numbers. These synthetic cursors are simple markers
          // in the form `p:<page>` and are not used for network requests.
          const newPageCursors: Record<number, string | null> = {};
          for (let p = 1; p <= totalPages; p++) {
            newPageCursors[p] = `p:${p}`;
          }
          setPageCursors(newPageCursors);
          // Compute and set the visible page using the helper to avoid duplicated logic
          changeIndexedPage(currentPage);
          console.log('Found servers', all);
        } else {
          // Direct API path: keep using idbSearch.search as a local fallback/demo implementation
          // setServers(await idbSearch.search(searchQuery));
          // Build the API URL first with all parameters
          let baseUrl = registryUrl;
          const params = ['version=latest', `limit=${resultsPerPage}`];
          if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
          if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
          if (filterDate) params.push(`updated_since=${encodeURIComponent(filterDate.toISOString())}`);
          if (params.length > 0) baseUrl += `?${params.join('&')}`;
          // Wrap API URL with the CORS proxy
          const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(baseUrl)}`;
          // console.log('Fetching URL:', proxyUrl);
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: { Accept: 'application/json, application/problem+json' },
            cache: 'force-cache' as const,
          });
          if (!response.ok) throw new Error(`Error when querying the registry API (${response.status})`);
          const data = await response.json();
          // console.log('Fetched data:', data);
          setServers(data.servers || []);
          setNextCursor(data.metadata?.nextCursor || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [filterDate, registryUrl, resultsPerPage, useIndex, currentPage, changeIndexedPage, pkgFilters, remoteFilters]
  );

  useEffect(() => {
    // Re-run search with the current query to refresh results and pagination
    fetchServers(search, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useIndex, pkgFilters, remoteFilters]);

  const doSearch = (newSearch: string) => {
    setSearch(newSearch);
    setCurrentCursor(null);
    setPreviousCursors([]);
    setNextCursor(null);
    setCurrentPage(1);
    setPageCursors({ 1: null });
    indexedResultsRef.current = null;
    fetchServers(newSearch, null);
    // // If using index, make sure servers are initialized for the selected registry URL
    // (async () => {
    //   try {
    //     if (useIndex) {
    //       setInitializingIndex(true);
    //       await idbSearch.initServers(registryUrl);
    //     }
    //   } catch (err) {
    //     // ignore
    //   } finally {
    //     setInitializingIndex(false);
    //     fetchServers(newSearch, null);
    //   }
    // })();
  };

  const handleNext = () => {
    if (useIndex) {
      // Client-side pagination: just advance the page if possible. Compute the
      // new page and update the visible slice directly (avoids closure timing
      // issues with fetchServers using `currentPage`).
      const total = indexedResultsRef.current?.length || 0;
      const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));
      if (currentPage < totalPages) {
        changeIndexedPage(currentPage + 1);
      }
      return;
    }

    if (nextCursor) {
      // Store the cursor for the next page so we can jump back to it later
      setPageCursors((prev) => ({ ...prev, [currentPage + 1]: nextCursor }));
      setPreviousCursors((prev) => [...prev, currentCursor || '']);
      setCurrentCursor(nextCursor);
      setCurrentPage((prev) => prev + 1);
      fetchServers(search, nextCursor);
    }
  };

  const handlePrevious = () => {
    if (useIndex) {
      if (currentPage > 1) changeIndexedPage(currentPage - 1);
      return;
    }

    if (previousCursors.length > 0) {
      const prevCursor = previousCursors[previousCursors.length - 1];
      setPreviousCursors((prev) => prev.slice(0, -1));
      setCurrentCursor(prevCursor === '' ? null : prevCursor);
      setCurrentPage((prev) => prev - 1);
      fetchServers(search, prevCursor === '' ? null : prevCursor);
    }
  };

  // NOTE: For cursor-based pagination, we can't jump to arbitrary pages, we can only navigate sequentially
  const handleGoToPage = (page: number) => {
    if (page === currentPage) return;
    // If using client-side indexed results, jump directly using the helper to
    // avoid relying on async state updates and network cursors.
    if (useIndex) {
      changeIndexedPage(page);
      return;
    }
    // If user requests page 1, reset to initial state
    if (page === 1) {
      setCurrentCursor(null);
      setPreviousCursors([]);
      setCurrentPage(1);
      fetchServers(search, null);
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
      fetchServers(search, cursorForPage);
      return;
    }

    // If the requested page is the immediate next one and we have a nextCursor, fall back to sequential navigation

    if (page === currentPage + 1 && nextCursor) handleNext();
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
      {/* Navigation header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-col sm:flex-row sm:h-16 items-start sm:items-center justify-between gap-3 sm:gap-0 px-4 py-3 sm:py-0 mx-auto max-w-7xl">
          <div
            role="button"
            tabIndex={0}
            aria-label="Clear search"
            onClick={() => doSearch('')}
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
                  <div className="px-2 py-2 border-b">
                    {/* Use local index switch */}
                    <div className="flex justify-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-pressed={useIndex}
                              onClick={() => toggleIndex(!useIndex)}
                              onKeyDown={(e) => {
                                if (e.key === ' ' || e.key === 'Enter') {
                                  e.preventDefault();
                                  (e.target as HTMLElement).click();
                                }
                              }}
                              className="text-sm text-muted-foreground text-left"
                            >
                              ⚡️ Use local index
                            </button>
                            <Switch
                              aria-label="Use local index"
                              checked={useIndex}
                              disabled={initializingIndex}
                              onCheckedChange={toggleIndex}
                            />
                            {initializingIndex && <Spinner className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            This will download and index the entire MCP registry in your browser.{' '}
                          </p>
                          <p className="text-sm">
                            It enables searching on descriptions, and filtering by server types, but may take some time
                            and use local storage.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
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
                            onClick={() => doSearch(item.serverName)}
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
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
          {/* Search Bar */}
          <div className="w-full max-w-2xl mt-2">
            <div className="relative flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <div className="flex">
                  <input
                    type="text"
                    placeholder={useIndex ? `Search MCP servers` : `Search MCP servers by name`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        doSearch(search);
                      }
                    }}
                    className="w-full rounded-lg border border-input bg-background px-10 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => doSearch(search)}
                    className="-ml-10 mr-2 self-center h-5 w-8 px-2 text-muted-foreground/80"
                    aria-label="Search"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {/* Filter Date Button only on direct API */}
              {!useIndex && (
                <DatePicker
                  date={filterDate}
                  onDateChange={setFilterDate}
                  placeholder="Filter by date"
                  variant={filterDate ? 'default' : 'outline'}
                  className="h-auto py-3 px-4 text-muted-foreground"
                />
              )}
              {/* Filters for indexed servers */}
              {useIndex && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-auto py-3 px-4 gap-2">
                      {/* <span className="text-sm">Filters</span>
                      <span className="text-xs text-muted-foreground">types</span> */}
                      <Filter className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-3 py-2">
                      <div className="text-xs text-muted-foreground mb-2">Packages</div>
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={pkgFilters.npm}
                            onCheckedChange={(v: boolean | 'indeterminate') =>
                              setPackageFilters((prev) => ({ ...prev, npm: !!v }))
                            }
                          />
                          <span className="text-sm">NPM</span>
                          <img src={NpmLogo} alt="NPM" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={pkgFilters.pypi}
                            onCheckedChange={(v: boolean | 'indeterminate') =>
                              setPackageFilters((prev) => ({ ...prev, pypi: !!v }))
                            }
                          />
                          <span className="text-sm">PyPI</span>
                          <img src={PypiLogo} alt="PyPI" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={pkgFilters.oci}
                            onCheckedChange={(v: boolean | 'indeterminate') =>
                              setPackageFilters((prev) => ({ ...prev, oci: !!v }))
                            }
                          />
                          <span className="text-sm">OCI (docker)</span>
                          <img src={DockerLogo} alt="Docker" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={pkgFilters.other}
                            onCheckedChange={(v: boolean | 'indeterminate') =>
                              setPackageFilters((prev) => ({ ...prev, other: !!v }))
                            }
                          />
                          <span className="text-sm">Other</span>
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </label>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <div className="px-3 py-2">
                      <div className="text-xs text-muted-foreground mb-2">Remotes</div>
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={remoteFilters['streamable-http']}
                            onCheckedChange={(v: boolean | 'indeterminate') =>
                              setRemoteFilters((prev) => ({ ...prev, 'streamable-http': !!v }))
                            }
                          />
                          <span className="text-sm">Streamable HTTP</span>
                          {getRemoteIcon({ type: 'streamable-http' })}
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={remoteFilters.sse}
                            onCheckedChange={(v: boolean | 'indeterminate') =>
                              setRemoteFilters((prev) => ({ ...prev, sse: !!v }))
                            }
                          />
                          <span className="text-sm">SSE</span>
                          {getRemoteIcon({ type: 'sse' })}
                        </label>
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

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
                  <ServerCard item={item} registryUrl={registryUrl} stackCtrl={stackCtrl} />
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
                        onClick={() => {
                          if (useIndex) changeIndexedPage(pageNum);
                          else handleGoToPage(pageNum);
                        }}
                        className={pageNum === currentPage ? 'pointer-events-none' : 'cursor-pointer'}
                        isActive={pageNum === currentPage}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  {/* If there's a next page that we haven't stored yet, show the next page number and allow sequential next */}
                  {!useIndex && hasNext && !pageCursors[lastVisitedPage + 1] && (
                    <PaginationItem>
                      <PaginationLink onClick={() => handleNext()} className="cursor-pointer">
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
