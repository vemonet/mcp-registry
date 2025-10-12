import { Link2, HardDriveUpload, Rss, Package, Plus, Container, Settings, Delete, FileDown } from 'lucide-react';

import {
  buildIdeConfigForPkg,
  buildIdeConfigForRemote,
  genCursorConfigForPkg,
  genCursorConfigForRemote,
  genVscodeConfigForPkg,
  genVscodeConfigForRemote,
} from '~/lib/ide-config';
import type { ServerItem, ServerPackage, ServerPackageArgument, ServerRemote } from '~/lib/types';
import { CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import PypiLogo from '~/components/logos/pypi-logo.svg';
import NpmLogo from '~/components/logos/npm-logo.svg';
import VscodeLogo from '~/components/logos/vscode-logo.svg';
import CursorLogo from '~/components/logos/cursor-logo.svg';
import { CopyButton } from './ui/copy-button';

/** Display all details on a MCP server */
export const ServerEndpointsList = ({
  item,
  addToStack,
  isInStack,
  removeFromStack,
}: {
  item: ServerItem;
  addToStack: (serverName: string, type: 'remote' | 'package', data: any, index: number) => void;
  isInStack: (serverName: string, type: 'remote' | 'package', index: number) => boolean;
  removeFromStack: (serverName: string, type: 'remote' | 'package', index: number) => void;
}) => {
  // const itemMeta = item._meta?.['io.modelcontextprotocol.registry/official'];

  return (
    <CardContent className="pt-0 space-y-2 space-x-2 text-center">
      {/* Packages Section */}
      {item.server.packages &&
        item.server.packages.map((pkg, pkgIndex) => {
          // {/* Get package URL */}
          const packageUrl = getPkgUrl(pkg);
          return (
            <Popover key={pkgIndex}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs hover:cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                  {getPkgIcon(pkg)}
                  <span className="font-mono text-muted-foreground">{pkg.identifier}</span>
                  {pkg.environmentVariables && Object.keys(pkg.environmentVariables).length > 0 && (
                    <Settings className="text-slate-400 flex-shrink-0" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-fit text-sm" onClick={(e) => e.stopPropagation()}>
                {/* Package details */}
                <div>
                  <div className="flex gap-2 justify-center mb-3 font-mono text-lg">
                    {packageUrl ? (
                      <a
                        href={packageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-2 items-center hover:text-muted-foreground"
                      >
                        {getPkgIcon(pkg)}
                        <code className="px-2">{pkg.identifier}</code>
                      </a>
                    ) : (
                      <span>
                        {getPkgIcon(pkg)} <code>{pkg.identifier}</code>
                      </span>
                    )}

                    <CopyButton content={pkg.identifier} variant="outline" size="sm" />
                  </div>
                  <p>
                    <span className="text-muted-foreground">📦 Type:</span> <code>{pkg.registryType}</code>
                  </p>
                  {pkg.registryBaseUrl && (
                    <p>
                      <span className="text-muted-foreground">📘 Registry:</span>{' '}
                      <a
                        href={pkg.registryBaseUrl}
                        className="hover:text-muted-foreground"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {pkg.registryBaseUrl}
                      </a>
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">🏷️ Version:</span> <code>{pkg.version}</code>
                  </p>
                  {pkg.runtimeHint && (
                    <p>
                      <span className="text-muted-foreground">💡 Runtime hint:</span> <code>{pkg.runtimeHint}</code>
                    </p>
                  )}
                  {pkg.environmentVariables && pkg.environmentVariables.length > 0 && (
                    <div className="mt-2">
                      <span className="text-muted-foreground">⚙️ Environment Variables:</span>
                      <div className="mt-1 space-y-1">
                        {pkg.environmentVariables.map((envVar: any) => (
                          <div key={envVar.name} className="text-xs">
                            <div className="flex items-center gap-1">
                              <code>{envVar.name}</code>
                              {envVar.isRequired && <span className="text-red-500 text-xs">*</span>}
                              {envVar.isSecret && <span className="text-orange-500 text-xs">🔒</span>}
                              {envVar.format && (
                                <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
                                  {envVar.format}
                                </Badge>
                              )}
                              {envVar.description && (
                                <span className="text-muted-foreground ml-2">{envVar.description}</span>
                              )}
                              {envVar.value !== undefined && (
                                <span className="text-muted-foreground ml-2 flex items-center gap-2">
                                  <span className="text-muted-foreground">value:</span>
                                  <code>{envVar.value}</code>
                                  <CopyButton content={envVar.value} variant="outline" size="sm" />
                                </span>
                              )}
                              {envVar.default && (
                                <span className="text-muted-foreground">
                                  (default: <code>{envVar.default}</code>)
                                </span>
                              )}
                            </div>

                            {envVar.choices && envVar.choices.length > 0 && (
                              <div className="ml-4 mt-1 flex flex-wrap gap-1">
                                {envVar.choices.map((choice: string) => (
                                  <Badge key={choice} variant="secondary" className="text-xs px-1 py-0">
                                    {choice}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pkg.runtimeArguments && pkg.runtimeArguments.length > 0 && (
                    <div className="mt-2">
                      <span className="text-muted-foreground">⚡ Runtime Arguments:</span>
                      <div className="mt-1 space-y-1">{formatArgs(pkg.runtimeArguments)}</div>
                    </div>
                  )}
                  {pkg.packageArguments && pkg.packageArguments.length > 0 && (
                    <div className="mt-2">
                      <span className="text-muted-foreground">⌨️ Package Arguments:</span>
                      <div className="mt-1 space-y-1">{formatArgs(pkg.packageArguments)}</div>
                    </div>
                  )}
                </div>

                {/* Actions - wider popover and paired buttons */}
                <div className="mt-3 flex flex-col gap-2">
                  {/* VSCode and Cursor cards */}
                  <div className="flex flex-col gap-2">
                    {/* VSCode card */}
                    <div className="bg-muted/70 p-2 rounded-md inline-flex w-fit items-center gap-2">
                      <img src={VscodeLogo} alt="VSCode" className="h-4 w-4" />
                      <div className="flex-1 flex gap-2">
                        <a
                          href={`vscode:mcp/install?${encodeURIComponent(
                            JSON.stringify({
                              name: item.server.name,
                              ...buildIdeConfigForPkg(item.server.name, pkg)[item.server.name],
                            })
                          )}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex"
                        >
                          <Button variant="outline" size="sm">
                            <FileDown /> Install in VSCode
                          </Button>
                        </a>
                        <CopyButton content={genVscodeConfigForPkg(item.server.name, pkg)} variant="outline" size="sm">
                          Copy config
                        </CopyButton>
                      </div>
                    </div>

                    {/* Cursor card */}
                    <div className="bg-muted/70 p-2 rounded-md inline-flex w-fit items-center gap-2">
                      <img src={CursorLogo} alt="Cursor" className="[filter:invert(0)] dark:[filter:invert(1)]" />
                      <div className="flex-1 flex gap-2">
                        <a
                          href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${item.server.name}&config=${encodeURIComponent(JSON.stringify(buildIdeConfigForPkg(item.server.name, pkg)[item.server.name]))}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="outline" size="sm">
                            <FileDown /> Install in Cursor
                          </Button>
                        </a>
                        <CopyButton content={genCursorConfigForPkg(item.server.name, pkg)} variant="outline" size="sm">
                          Copy config
                        </CopyButton>
                      </div>
                    </div>

                    <Button
                      className="w-fit"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        return isInStack(item.server.name, 'package', pkgIndex)
                          ? removeFromStack(item.server.name, 'package', pkgIndex)
                          : addToStack(item.server.name, 'package', pkg, pkgIndex);
                      }}
                    >
                      {isInStack(item.server.name, 'package', pkgIndex) ? (
                        <>
                          <Delete /> Remove from your stack
                        </>
                      ) : (
                        <>
                          <Plus /> Add to your stack
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}

      {/* Remote Servers Section */}
      {item.server.remotes &&
        item.server.remotes.length > 0 &&
        item.server.remotes.map((remote, remoteIndex) => (
          <Popover key={remoteIndex}>
            <PopoverTrigger asChild>
              <Button
                // className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-muted hover:bg-muted/30 border border-border rounded-md transition-colors cursor-pointer"
                variant="outline"
                size="sm"
                className="text-xs hover:cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                {getRemoteIcon(remote)}
                <span className="break- font-mono text-muted-foreground">{remote.url?.replace('https://', '')}</span>
                {remote.headers && Object.keys(remote.headers).length > 0 && (
                  <Settings className="text-slate-400 flex-shrink-0" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-fit text-sm" onClick={(e) => e.stopPropagation()}>
              {/* Remote details */}
              <div className="space-y-2">
                <div className="flex gap-2 justify-center mb-4 font-mono text-md">
                  <a
                    href={remote.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 items-center hover:text-muted-foreground"
                  >
                    {getRemoteIcon(remote)}
                    {remote.url}
                  </a>
                  <CopyButton content={remote.url} variant="outline" size="sm" />
                </div>
                <p>
                  <span className="text-muted-foreground">🚛 Transport:</span> <code>{remote.type}</code>
                </p>
                {remote.headers && (
                  <div>
                    <span className="text-muted-foreground">⚙️ Headers:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(remote.headers).map(([key, header]) => (
                        <div key={key} className="text-xs">
                          <div className="flex items-center gap-1">
                            <code>{header.name}</code>
                            {header.isRequired && <span className="text-red-500 text-xs">*</span>}
                            {header.isSecret && <span className="text-orange-500 text-xs">🔒</span>}
                            {header.format && (
                              <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
                                {header.format}
                              </Badge>
                            )}
                            {header.description && <span className="text-muted-foreground">{header.description}</span>}
                            {header.value !== undefined && (
                              <span className="text-muted-foreground flex items-center gap-2">
                                <span>· value:</span>
                                <code>{header.value}</code>
                                <CopyButton content={header.value} variant="outline" size="sm" />
                              </span>
                            )}
                            {header.default && (
                              <span className="text-muted-foreground">
                                (default: <code>{header.default}</code>)
                              </span>
                            )}
                          </div>
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

                <div className="mt-3 flex flex-col gap-2">
                  {/* VSCode and Cursor cards */}
                  <div className="flex flex-col gap-2">
                    {/* VSCode card */}
                    <div className="bg-muted/70 p-2 rounded-md inline-flex w-fit items-center gap-3">
                      <img src={VscodeLogo} alt="VSCode" className="h-4 w-4" />
                      <div className="flex gap-2">
                        <a
                          href={`vscode:mcp/install?${encodeURIComponent(
                            JSON.stringify({
                              name: item.server.name,
                              ...buildIdeConfigForRemote(item.server.name, remote)[item.server.name],
                            })
                          )}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="outline" size="sm">
                            <FileDown /> Install in VSCode
                          </Button>
                        </a>
                        <CopyButton
                          content={genVscodeConfigForRemote(item.server.name, remote)}
                          variant="outline"
                          size="sm"
                        >
                          Copy config
                        </CopyButton>
                      </div>
                    </div>

                    {/* Cursor card */}
                    <div className="bg-muted/70 p-2 rounded-md inline-flex w-fit items-center gap-3">
                      <img src={CursorLogo} alt="Cursor" className="[filter:invert(0)] dark:[filter:invert(1)]" />
                      <div className="flex-1 flex gap-2">
                        <a
                          href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${item.server.name}&config=${encodeURIComponent(JSON.stringify(buildIdeConfigForRemote(item.server.name, remote)[item.server.name]))}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="outline" size="sm">
                            <FileDown /> Install in Cursor
                          </Button>
                        </a>
                        <CopyButton
                          content={genCursorConfigForRemote(item.server.name, remote)}
                          variant="outline"
                          size="sm"
                        >
                          Copy config
                        </CopyButton>
                      </div>
                    </div>

                    {/* Add/remote to stack button */}
                    <Button
                      className="w-fit"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        return isInStack(item.server.name, 'remote', remoteIndex)
                          ? removeFromStack(item.server.name, 'remote', remoteIndex)
                          : addToStack(item.server.name, 'remote', remote, remoteIndex);
                      }}
                    >
                      {isInStack(item.server.name, 'remote', remoteIndex) ? (
                        <>
                          <Delete className="h-3.5 w-3.5" /> Remove from your stack
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" /> Add to your stack
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ))}
    </CardContent>
  );
};

/** Get URL to view the package in its registry */
const getPkgUrl = (pkg: ServerPackage) => {
  // Determine base registry URL (in case not defined, default to docker)
  const registryUrl = pkg.registryBaseUrl
    ? pkg.registryBaseUrl
    : pkg.registryType === 'npm'
      ? 'https://registry.npmjs.com'
      : pkg.registryType === 'pypi'
        ? 'https://pypi.org'
        : 'https://docker.io';
  return pkg.registryType === 'npm'
    ? `${registryUrl.replace('registry', 'www')}/package/${pkg.identifier}`
    : pkg.registryType === 'pypi'
      ? `${registryUrl}/project/${pkg.identifier}/`
      : pkg.registryType === 'oci' && registryUrl.startsWith('https://docker.io')
        ? `https://hub.docker.com/r/${pkg.identifier}`
        : `${registryUrl}/${pkg.identifier}`;
};

/** Get icon for package registry */
const getPkgIcon = (pkg: ServerPackage) => {
  if (pkg.registryType === 'npm') {
    return <img src={NpmLogo} alt="NPM" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />;
  } else if (pkg.registryType === 'pypi') {
    return <img src={PypiLogo} alt="PyPI" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />;
  } else if (pkg.registryType === 'oci' || pkg.registryType === 'docker') {
    return <Container className="h-4 w-4 text-muted-foreground" />;
  } else {
    return <Package className="h-4 w-4 text-muted-foreground" />;
  }
};

/** Get icon for remote access points */
const getRemoteIcon = (remote: ServerRemote) => {
  return remote.type === 'sse' ? (
    <HardDriveUpload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  ) : remote.type.includes('http') ? (
    <Rss className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  ) : (
    <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  );
};

const formatArgs = (args: ServerPackageArgument[]) => {
  return args.map((arg, argIndex) => (
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
            <code className="ml-2">{arg.value ?? arg.name}</code>
            <Badge variant="outline" className="text-xs px-1 py-0">
              positional
            </Badge>
          </>
        )}
        {/* format/type badge */}
        {arg.format && (
          <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
            {arg.format}
          </Badge>
        )}
        {/* required flag (supports both `isRequired` and `required`) */}
        {(arg.isRequired || arg.required) && (
          <Badge variant="destructive" className="text-xs px-1 py-0 ml-1">
            required
          </Badge>
        )}
        {/* secret marker */}
        {arg.isSecret && <span className="text-orange-500 text-xs ml-1">🔒</span>}
        {/* repeated (array) */}
        {arg.isRepeated && (
          <Badge variant="secondary" className="text-xs px-1 py-0 ml-1">
            repeated
          </Badge>
        )}
        {/* value hint */}
        {arg.valueHint && (
          <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
            {arg.valueHint}
          </Badge>
        )}
        {/* human description */}
        {arg.description && <span className="text-muted-foreground ml-2">{arg.description}</span>}
        {/* explicit value (positional) */}
        {arg.value !== undefined && (
          <span className="text-muted-foreground flex items-center gap-2">
            <span className="text-muted-foreground">· value:</span>
            <code>{arg.value}</code>
            <CopyButton content={arg.value} variant="outline" size="sm" />
          </span>
        )}
        {/* default value */}
        {arg.default !== undefined && (
          <span className="text-muted-foreground ml-2">
            (default: <code>{arg.default}</code>)
          </span>
        )}
      </div>

      {/* choices */}
      {arg.choices && arg.choices.length > 0 && (
        <div className="ml-4 mt-1 flex flex-wrap gap-1">
          {arg.choices.map((choice: string) => (
            <Badge key={choice} variant="secondary" className="text-xs px-1 py-0">
              {choice}
            </Badge>
          ))}
        </div>
      )}
    </div>
  ));
};
