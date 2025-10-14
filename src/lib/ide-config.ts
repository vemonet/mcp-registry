import type { IdeConfigPkg, IdeConfigRemote, McpServerPackage, McpServerRemote } from './types';

/** Build server config for a remote server */
export const buildIdeConfigForRemote = (remote: McpServerRemote): IdeConfigRemote => {
  const config: IdeConfigRemote = {
    type: remote.type === 'streamable-http' ? 'http' : remote.type,
    url: remote.url,
  };
  // TODO: Add headers if present
  if (remote.headers && remote.headers.length > 0) {
    config.headers = {};
    remote.headers.forEach((header) => {
      // prefer explicit `value` set by the UI/form, fall back to default or a placeholder
      config.headers![header.name] = header.value ?? header.default ?? `<${header.description ?? header.name}>`;
    });
  }
  return config;
};

/** Build server config for a package */
export const buildIdeConfigForPkg = (pkg: McpServerPackage): IdeConfigPkg => {
  const config: IdeConfigPkg = { command: '' };
  // Add runtime command based on package type
  if (pkg.registryType === 'npm') {
    config.command = pkg.runtimeHint || 'npx';
    config.args = [pkg.identifier];
  } else if (pkg.registryType === 'pypi') {
    config.command = pkg.runtimeHint || 'uvx';
    config.args = [pkg.identifier];
  } else if (pkg.registryType === 'oci') {
    // For Docker/OCI packages, use docker run command
    config.command = pkg.runtimeHint || 'docker';
    config.args = [
      'run',
      '-i',
      '--rm',
      `${pkg.registryBaseUrl?.replace('https://', '') || 'docker.io'}/${pkg.identifier}:${pkg.version}`,
    ];
  }
  // Add environment variables if present
  if (pkg.environmentVariables && pkg.environmentVariables.length > 0) {
    config.env = {};
    pkg.environmentVariables.forEach((envVar) => {
      // prefer explicit `value` set by the UI/form, fall back to default or a placeholder
      config.env![envVar.name] = envVar.value ?? envVar.default ?? `<${envVar.description ?? envVar.name}>`;
    });
  }
  return config;
};
