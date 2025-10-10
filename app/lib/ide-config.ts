import type { ServerRemote } from './types';

/** Build server config for a remote server */
export const buildIdeConfigForRemote = (serverName: string, remote: ServerRemote) => {
  // const serverName = serverName.replace(/[\/\.]/g, '-');
  const config: any = {
    [serverName]: {
      url: remote.url,
      type: remote.type === 'streamable-http' ? 'http' : remote.type,
    },
  };
  // Add headers if present?
  return config;
};

/** Build server config for a package */
export const buildIdeConfigForPkg = (serverName: string, pkg: any) => {
  // const serverName = serverName.replace(/[\/\.]/g, '-');
  const config: any = {
    [serverName]: {} as any,
  };

  // Add runtime command based on package type
  if (pkg.registryType === 'npm') {
    config[serverName].command = pkg.runtimeHint || 'npx';
    config[serverName].args = [pkg.identifier];
  } else if (pkg.registryType === 'pypi') {
    config[serverName].command = pkg.runtimeHint || 'uvx';
    config[serverName].args = [pkg.identifier];
  } else if (pkg.registryType === 'oci') {
    // For Docker/OCI packages, use docker run command
    config[serverName].command = 'docker';
    config[serverName].args = [
      'run',
      '-i',
      '--rm',
      `${pkg.registryBaseUrl?.replace('https://', '') || 'docker.io'}/${pkg.identifier}:${pkg.version}`,
    ];
  }

  // Add environment variables if present
  if (pkg.environmentVariables && pkg.environmentVariables.length > 0) {
    config[serverName].env = {};
    pkg.environmentVariables.forEach((envVar: any) => {
      config[serverName].env[envVar.name] = envVar.default || `<${envVar.description}>`;
    });
  }

  return config;
};

/** Generate VSCode config for a remote server */
export const genVscodeConfigForRemote = (serverName: string, remote: ServerRemote) => {
  return JSON.stringify(
    {
      servers: buildIdeConfigForRemote(serverName, remote),
      // inputs: []
    },
    null,
    2
  );
};

/** Generate VSCode config for a package */
export const genVscodeConfigForPkg = (serverName: string, pkg: any) => {
  return JSON.stringify(
    {
      servers: buildIdeConfigForPkg(serverName, pkg),
    },
    null,
    2
  );
};

/** Generate Cursor config for a remote server */
export const genCursorConfigForRemote = (serverName: string, remote: ServerRemote) => {
  return JSON.stringify(
    {
      mcpServers: buildIdeConfigForRemote(serverName, remote),
    },
    null,
    2
  );
};

/** Generate Cursor config for a package */
export const genCursorConfigForPkg = (serverName: string, pkg: any) => {
  return JSON.stringify(
    {
      mcpServers: buildIdeConfigForPkg(serverName, pkg),
    },
    null,
    2
  );
};
