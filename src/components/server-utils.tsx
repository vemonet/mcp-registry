import { HardDriveUpload, Rss, Link2, Package } from 'lucide-react';

import type { McpServerPkg, McpServerRemote } from '~/lib/types';
import PypiLogo from '~/components/logos/pypi.svg';
import NpmLogo from '~/components/logos/npm.svg';
import DockerLogo from '~/components/logos/docker.svg';

/** Get icon for remote access points */
export const getRemoteIcon = (remote: McpServerRemote) => {
  return remote.type === 'sse' ? (
    <HardDriveUpload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  ) : remote.type.includes('http') ? (
    <Rss className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  ) : (
    <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  );
};

/** Get icon for package registry */
export const getPkgIcon = (pkg: McpServerPkg) => {
  // Render icons inside a fixed-size square so their visual size doesn't change based on surrounding content
  const baseContainer = 'inline-flex items-center justify-center h-4 w-4 flex-shrink-0';
  if (pkg.registryType === 'npm') {
    return (
      <span className={baseContainer} aria-hidden>
        <img src={NpmLogo} alt="NPM" className="h-full w-full object-contain" style={{ filter: 'grayscale(40%)' }} />
      </span>
    );
  } else if (pkg.registryType === 'pypi') {
    return (
      <span className={baseContainer} aria-hidden>
        <img src={PypiLogo} alt="PyPI" className="h-full w-full object-contain" style={{ filter: 'grayscale(40%)' }} />
      </span>
    );
  } else if (pkg.registryType === 'oci' || pkg.registryType === 'docker') {
    return (
      <span className={baseContainer} aria-hidden>
        <img
          src={DockerLogo}
          alt="Docker"
          className="h-full w-full object-contain"
          style={{ filter: 'grayscale(40%)' }}
        />
      </span>
    );
  } else {
    return (
      <span className={baseContainer} aria-hidden>
        <Package className="h-full w-full text-muted-foreground" />
      </span>
    );
  }
};

/** Get URL to view the package in its registry */
export const getPkgUrl = (pkg: McpServerPkg) => {
  // Determine base registry URL (in case not defined, default to docker)
  const registryUrl = pkg.registryBaseUrl
    ? pkg.registryBaseUrl
    : pkg.registryType === 'npm'
      ? 'https://registry.npmjs.com'
      : pkg.registryType === 'pypi'
        ? 'https://pypi.org'
        : pkg.registryType === 'nuget'
          ? 'https://api.nuget.org'
          : 'https://docker.io';
  return pkg.registryType === 'npm'
    ? `${registryUrl.replace('registry', 'www')}/package/${pkg.identifier}`
    : pkg.registryType === 'pypi'
      ? `${registryUrl}/project/${pkg.identifier}/`
      : pkg.registryType === 'oci' && registryUrl.startsWith('https://docker.io')
        ? `https://hub.docker.com/r/${pkg.identifier}`
        : `${registryUrl}/${pkg.identifier}`;
};

/** Get default pkg command based on type */
export const getPkgDefaultCmd = (pkg: McpServerPkg) => {
  if (pkg.runtimeHint) return pkg.runtimeHint;
  if (pkg.registryType === 'npm') return 'npx';
  if (pkg.registryType === 'pypi') return 'uvx';
  if (pkg.registryType === 'oci') return 'docker';
  if (pkg.registryType === 'nuget') return 'dnx';
  return '';
};
