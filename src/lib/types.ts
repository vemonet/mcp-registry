export interface StackItem {
  serverName: string;
  type: 'remote' | 'package';
  data: McpServerPackage | McpServerRemote;
  // Optional IDE configuration filled by the user for this stack entry
  ideConfig?: IdeConfig;
  index: number;
}

// User-filled IDE config union capturing either package or remote config
export type IdeConfig = IdeConfigPkg | IdeConfigRemote;

export interface IdeConfigPkg {
  command: string;
  args?: Array<string>;
  env?: { [key: string]: string };
  // cwd?: string; // not currently used
}

export interface IdeConfigRemote {
  type: string;
  url?: string;
  headers?: { [key: string]: string };
}

// https://registry.modelcontextprotocol.io/docs#/schemas/ServerResponse
export interface McpServerItem {
  server: McpServerDetails;
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: {
      status?: string;
      publishedAt?: string;
      updatedAt?: string;
      isLatest?: boolean;
    };
  };
}

export interface McpServerDetails {
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
  remotes?: Array<McpServerRemote>;
  packages?: Array<McpServerPackage>;
  websiteUrl?: string;
}

export interface McpServerPackage {
  identifier: string;
  registryType: string;
  registryBaseUrl: string;
  version: string;
  runtimeHint?: string;
  /// RuntimeArguments are passed to the package's runtime command (e.g., docker, npx)
  runtimeArguments?: Array<McpServerPackageArgument>;
  /// PackageArguments are passed to the package's binary
  packageArguments?: Array<McpServerPackageArgument>;
  transport?: McpServerRemote;
  environmentVariables?: Array<EnvVarOrHeader>;
  fileSha256?: string;
}

export interface McpServerRemote {
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
export interface McpServerPackageArgument {
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
