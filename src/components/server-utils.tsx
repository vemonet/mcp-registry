import { HardDriveUpload, Rss, Link2, Package } from 'lucide-react';

import type { McpServerPkg, McpServerRemote } from '~/lib/types';
import PypiLogo from '~/components/logos/pypi-logo.svg';
import NpmLogo from '~/components/logos/npm-logo.svg';
import DockerLogo from '~/components/logos/docker-logo.svg';

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
  if (pkg.registryType === 'npm') {
    return <img src={NpmLogo} alt="NPM" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />;
  } else if (pkg.registryType === 'pypi') {
    return <img src={PypiLogo} alt="PyPI" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />;
  } else if (pkg.registryType === 'oci' || pkg.registryType === 'docker') {
    return <img src={DockerLogo} alt="Docker" className="h-4 w-4" style={{ filter: 'grayscale(40%)' }} />;
  } else {
    return <Package className="h-4 w-4 text-muted-foreground" />;
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
        : 'https://docker.io';
  return pkg.registryType === 'npm'
    ? `${registryUrl.replace('registry', 'www')}/package/${pkg.identifier}`
    : pkg.registryType === 'pypi'
      ? `${registryUrl}/project/${pkg.identifier}/`
      : pkg.registryType === 'oci' && registryUrl.startsWith('https://docker.io')
        ? `https://hub.docker.com/r/${pkg.identifier}`
        : `${registryUrl}/${pkg.identifier}`;
};

/** Get icon for remote access points */
export const getPkgDefaultCmd = (pkg: McpServerPkg) => {
  if (pkg.runtimeHint) return pkg.runtimeHint;
  if (pkg.registryType === 'npm') return 'npx';
  if (pkg.registryType === 'pypi') return 'uvx';
  if (pkg.registryType === 'oci') return 'docker';
  return '';
};
