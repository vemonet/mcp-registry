export interface EnvironmentVariable {
  name: string;
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
  default?: string;
}

export interface RuntimeArgumentBase {
  description: string;
}

export interface PositionalRuntimeArgument extends RuntimeArgumentBase {
  type: 'positional';
  value: string;
}

export interface NamedRuntimeArgument extends RuntimeArgumentBase {
  type: 'named';
  name: string;
}

export type RuntimeArgument = PositionalRuntimeArgument | NamedRuntimeArgument;

export interface ServerPackage {
  registryType: string;
  registryBaseUrl: string;
  identifier: string;
  version: string;
  runtimeHint?: string;
  runtimeArguments?: Array<RuntimeArgument>;
  command?: string;
  args?: Array<string>;
  transport?: {
    type: string;
  };
  environmentVariables?: Array<EnvironmentVariable>;
}

export interface ServerRemote {
  type: string;
  url: string;
  headers?: Array<EnvironmentVariable>;
}

export interface ServerItem {
  server: {
    $schema?: string;
    name: string;
    description: string;
    version?: string;
    repository?: {
      url: string;
      source: string;
    };
    remotes?: Array<ServerRemote>;
    packages?: Array<ServerPackage>;
  };
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: {
      status?: string;
      publishedAt?: string;
      updatedAt?: string;
      isLatest?: boolean;
    };
  };
}

export interface StackItem {
  serverName: string;
  type: 'remote' | 'package';
  data: any;
  index: number;
}
