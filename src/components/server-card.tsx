import { useState } from 'react';
import {
  Link2,
  Copy,
  CheckCircle2,
  HardDriveUpload,
  Rss,
  Plug,
  Package,
  CheckCircle,
  XCircle,
  Calendar,
  Plus,
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
import type { ServerItem, ServerPackage } from '~/lib/types';
import { formatDate } from '~/lib/utils';
import { CardHeader, CardTitle, CardDescription, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/components/ui/tooltip';
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
import GithubLogo from '~/components/logos/github.svg';

/** Display all details on a MCP server */
export const ServerCard = ({
  item,
  addToStack,
  isInStack,
}: {
  item: ServerItem;
  addToStack: (serverName: string, type: 'remote' | 'package', data: any, index: number) => void;
  isInStack: (serverName: string, type: 'remote' | 'package', index: number) => boolean;
}) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
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
                    <div className="flex text-muted-foreground items-center gap-1 flex-shrink-0">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">
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
                      {new Date(item._meta['io.modelcontextprotocol.registry/official'].publishedAt).toLocaleString(
                        'fr-FR'
                      )}
                    </p>
                    {item._meta?.['io.modelcontextprotocol.registry/official']?.updatedAt && (
                      <p>
                        Updated at{' '}
                        {new Date(item._meta['io.modelcontextprotocol.registry/official'].updatedAt).toLocaleString(
                          'fr-FR'
                        )}
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
          {/* <ServerAccessSection server={item.server} addToStack={addToStack} isInStack={isInStack} /> */}
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
                            {pkg.environmentVariables && Object.keys(pkg.environmentVariables).length > 0 && (
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
                        {isInStack(item.server.name, 'package', pkgIndex) ? 'In your Stack' : 'Add to your Stack'}
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
                      {isInStack(item.server.name, 'remote', remoteIndex) ? 'In your Stack' : 'Add to your Stack'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyToClipboard(remote.url)} className="flex items-center gap-2">
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
    </>
  );
};

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
