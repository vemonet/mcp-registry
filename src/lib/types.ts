// https://registry.modelcontextprotocol.io/docs#/schemas/ServerResponse
export interface ServerItem {
  server: {
    $schema?: string;
    name: string;
    description: string;
    version?: string;
    repository?: {
      url: string;
      source: string;
      subfolder?: string;
      id?: string;
    };
    remotes?: Array<ServerRemote>;
    packages?: Array<ServerPackage>;
    websiteUrl?: string;
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

export interface ServerPackage {
  identifier: string;
  registryType: string;
  registryBaseUrl: string;
  version: string;
  runtimeHint?: string;
  /// RuntimeArguments are passed to the package's runtime command (e.g., docker, npx)
  runtimeArguments?: Array<ServerPackageArgument>;
  /// PackageArguments are passed to the package's binary
  packageArguments?: Array<ServerPackageArgument>;
  transport?: ServerRemote;
  environmentVariables?: Array<EnvVarOrHeader>;
  fileSha256?: string;
}

export interface ServerRemote {
  type: string;
  url?: string;
  headers?: Array<EnvVarOrHeader>;
}

export interface EnvVarOrHeader {
  name: string;
  value?: string;
  format?: string;
  choices?: Array<string>;
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
  default?: string;
}

// RuntimeArgument: unified shape used for packageArguments/runtimeArguments
export interface ServerPackageArgument {
  // A list of allowed choices for the argument, or null when not applicable
  choices: string[] | null;
  // Default value for the argument (if any)
  default?: string;
  // Human readable description
  description?: string;
  // Format hint (e.g. "int", "json", "path")
  format?: string;
  // Whether the argument can be repeated (array semantics)
  isRepeated?: boolean;
  // Whether the argument is required (explicit flag)
  isRequired?: boolean;
  // Whether the value is a secret and should be handled/stored securely
  isSecret?: boolean;
  // Argument name (identifier)
  name: string;
  // Argument type (e.g. "string", "number", "boolean", "named", "positional")
  type: string;
  // Secondary required flag (some schemas use `required` instead of `isRequired`)
  required?: boolean;
  // Value (for positional arguments or defaults provided inline)
  value?: string;
  // Hint about the value (e.g. "file-path", "env-var")
  valueHint?: string;
}

export interface StackItem {
  serverName: string;
  type: 'remote' | 'package';
  data: any;
  index: number;
}
