import { Link2, CheckCircle, XCircle, Calendar, House, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';

import type { ServerItem } from '~/lib/types';
import { formatDate } from '~/lib/utils';
import { CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '~/components/ui/dropdown-menu';
import { Spinner } from '~/components/ui/spinner';

function VersionList({
  serversData,
  loading,
  error,
  currentVersion,
  onSelect,
}: {
  serversData: any[] | null;
  loading: boolean;
  error: string | null;
  currentVersion?: string;
  onSelect?: (entry: any) => void;
}) {
  if (loading)
    return (
      <div className="flex items-center gap-2 p-2">
        <Spinner />
        <span className="text-xs text-muted-foreground">Loading versions…</span>
      </div>
    );

  if (error) return <div className="p-2 text-xs text-destructive">Failed to load versions: {error}</div>;

  if (!serversData || serversData.length === 0)
    return <div className="p-2 text-xs text-muted-foreground">No versions found</div>;

  return (
    <div>
      {serversData.map((entry) => {
        const v = entry?.server?.version || entry?.version || String(entry);
        const publishedAt = entry?._meta?.['io.modelcontextprotocol.registry/official']?.publishedAt;
        return (
          <DropdownMenuItem
            key={v}
            className="flex items-center justify-between"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(entry);
            }}
          >
            <div className="flex flex-col">
              <span className="text-sm">v{v}</span>
              {publishedAt && (
                <span className="text-xs text-muted-foreground">{new Date(publishedAt).toLocaleDateString()}</span>
              )}
            </div>
            {v === currentVersion ? <Check className="h-4 w-4 text-green-600" /> : null}
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}
import { Tooltip, TooltipTrigger, TooltipContent } from '~/components/ui/tooltip';
import GithubLogo from '~/components/logos/github.svg';
import { ServerEndpointsList } from './server-endpoints-list';

/** Display all details on a MCP server */
export const ServerCard = ({
  item,
  addToStack,
  isInStack,
  removeFromStack,
  registryUrl = 'https://registry.modelcontextprotocol.io/v0/servers',
}: {
  item: ServerItem;
  addToStack: (serverName: string, type: 'remote' | 'package', data: any, index: number) => void;
  isInStack: (serverName: string, type: 'remote' | 'package', index: number) => boolean;
  removeFromStack: (serverName: string, type: 'remote' | 'package', index: number) => void;
  registryUrl?: string;
}) => {
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [serversData, setServersData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = async () => {
    // avoid refetching if we already have data or are loading
    if (loading || serversData) return;
    setLoading(true);
    setError(null);
    try {
      const url = `${registryUrl}/${encodeURIComponent(item.server.name)}/versions`;
      // Then wrap it with the CORS proxy
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
      console.log('Fetching URL:', url);
      const res = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json, application/problem+json' },
        cache: 'force-cache' as const,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('Fetched versions for', item.server.name, data);
      let servers: any[] = [];
      if (data && Array.isArray((data as any).servers)) {
        servers = (data as any).servers;
      } else if (Array.isArray(data)) {
        servers = data;
      } else {
        for (const k of Object.keys(data || {})) {
          const v = (data as any)[k];
          if (Array.isArray(v)) {
            servers = v;
            break;
          }
        }
      }
      setServersData(servers);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // The displayed server info should prefer the selected entry (by version) if present.
  // Versions in the API can be returned as objects where the version sits either on
  // `entry.server.version` (preferred) or at `entry.version` (legacy). Normalize
  // both shapes into `displayedServer` so the UI consistently shows the selected
  // version, repo, website and metadata.
  const displayedServer = selectedEntry
    ? selectedEntry.server || { ...item.server, version: selectedEntry.version }
    : item.server;
  const displayedMeta =
    selectedEntry?._meta?.['io.modelcontextprotocol.registry/official'] ||
    item._meta?.['io.modelcontextprotocol.registry/official'];
  const itemMeta = displayedMeta;
  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-md break-words mb-2">{item.server.name}</CardTitle>
            <div className="flex items-center gap-2 mb-1">
              {/* Status indicator */}
              {itemMeta?.status && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-shrink-0">
                      {itemMeta.status === 'active' ? (
                        <CheckCircle className="h-4 w-4 text-green-700" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-800" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      <span className="text-muted-foreground">☑️ Status:</span> {itemMeta.status}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Version dropdown (fetch versions when opened) */}
              {displayedServer.version && (
                <DropdownMenu onOpenChange={(open) => open && fetchVersions()}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1"
                      onClick={(e) => {
                        // Prevent card-level click handlers from firing
                        e.stopPropagation();
                      }}
                      aria-label={`Versions for ${item.server.name}`}
                    >
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground bg-muted hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:cursor-pointer flex items-center gap-1"
                      >
                        v{displayedServer.version}
                        <ChevronDown className="h-3 w-3" />
                      </Badge>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-44 p-1">
                    <VersionList
                      serversData={serversData}
                      loading={loading}
                      error={error}
                      currentVersion={displayedServer.version}
                      onSelect={(entry) => setSelectedEntry(entry)}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* Date information */}
              {itemMeta?.publishedAt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex text-muted-foreground items-center gap-1 flex-shrink-0">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">
                        {(() => formatDate(new Date(itemMeta.updatedAt || itemMeta.publishedAt)))()}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      <span className="text-muted-foreground">📅 Published at</span>{' '}
                      {new Date(itemMeta.publishedAt).toLocaleString('fr-FR')}
                    </p>
                    {itemMeta?.updatedAt && itemMeta.updatedAt != itemMeta.publishedAt && (
                      <p>
                        <span className="text-muted-foreground">♻️ Updated at</span>{' '}
                        {new Date(itemMeta.updatedAt).toLocaleString('fr-FR')}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Repository/Source Code Link */}
              {displayedServer.repository?.url && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={displayedServer.repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1 rounded-md hover:bg-accent transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {displayedServer.repository?.source === 'github' ? (
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
                      <a
                        href={displayedServer.repository?.url}
                        className="hover:text-muted-foreground"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🔗 {displayedServer.repository?.url}
                      </a>
                    </p>
                    {displayedServer.repository?.subfolder && (
                      <p>
                        📂 Subfolder: <code>{displayedServer.repository.subfolder}</code>
                      </p>
                    )}
                    {displayedServer.repository?.id && (
                      <p>
                        🪪 ID: <code>{displayedServer.repository.id}</code>
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Website URL */}
              {displayedServer.websiteUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={displayedServer.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <House className="h-4 w-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      <a
                        href={displayedServer.websiteUrl}
                        className="hover:text-muted-foreground"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🔗 {displayedServer.websiteUrl}
                      </a>
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <CardDescription className="mt-2">{displayedServer.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {(() => {
        // Create a displayedItem that uses the selected version's server and metadata
        const displayedItem = {
          ...item,
          server: displayedServer,
          _meta: { ...(item._meta || {}), ['io.modelcontextprotocol.registry/official']: itemMeta },
        } as ServerItem;

        return (displayedServer.remotes && displayedServer.remotes.length > 0) ||
          (displayedServer.packages && displayedServer.packages.length > 0) ? (
          <ServerEndpointsList
            item={displayedItem}
            addToStack={addToStack}
            removeFromStack={removeFromStack}
            isInStack={isInStack}
          />
        ) : null;
      })()}
    </>
  );
};
