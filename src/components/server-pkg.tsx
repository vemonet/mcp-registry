import { Plus, Delete } from 'lucide-react';
import { z } from 'zod';
import { useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type {
  EnvVarOrHeader,
  IdeConfigPkg,
  IdeConfig,
  McpServerItem,
  McpServerPackage,
  McpServerPackageArgument,
  StackItem,
} from '~/lib/types';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import VscodeLogo from '~/components/logos/vscode-logo.svg';
import CursorLogo from '~/components/logos/cursor-logo.svg';
import { CopyButton } from './ui/copy-button';
import { FormItem, FormLabel, FormControl, FormField, Form, FormDescription, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { getPkgDefaultCmd, getPkgIcon, getPkgUrl } from './server-utils';
import { PasswordInput } from './ui/password-input';

/** Display all details on a MCP server */
export const ServerPkg = ({
  item,
  pkg,
  pkgIndex,
  addToStack,
  getFromStack,
  removeFromStack,
}: {
  item: McpServerItem;
  pkg: McpServerPackage;
  pkgIndex: number;
  addToStack: (
    serverName: string,
    type: 'remote' | 'package',
    data: McpServerPackage,
    index: number,
    ideConfig?: IdeConfig
  ) => void;
  getFromStack: (serverName: string, type: 'remote' | 'package', index: number) => StackItem | null;
  removeFromStack: (serverName: string, type: 'remote' | 'package', index: number) => void;
}) => {
  // If the user saved an ideConfig for this stack entry, use it as initial defaults
  const stackEntry = getFromStack(item.server.name, 'package', pkgIndex);
  const userConfig = stackEntry?.ideConfig as IdeConfigPkg | undefined;

  const initialPkgFormDefaults = useMemo(() => {
    return {
      command: userConfig?.command ?? getPkgDefaultCmd(pkg),
      // For runtime arguments use the provided value when available. For "named" flags that don't have
      // an explicit value, default to the flag name so the form will include the flag when submitted
      args:
        userConfig?.args ??
        (pkg.runtimeArguments
          ? pkg.runtimeArguments.map((a) => a.value ?? (a.type === 'named' && !a.format ? (a.name ?? '') : ''))
          : []),
      env:
        userConfig?.env ??
        (pkg.environmentVariables
          ? Object.fromEntries(pkg.environmentVariables.map((ev) => [ev.name, ev.value ?? ev.default ?? '']))
          : {}),
    } as const;
  }, [userConfig, pkg]);

  // Build a per-package zod schema so we can mark package-declared env vars as required
  // (non-empty) when the package declares them. This ensures react-hook-form's
  // form.trigger() will correctly report invalid when required env inputs are empty.
  const formSchema = useMemo(() => {
    const baseShape = {
      command: z.string().min(2, {
        message: 'Command to run the MCP server must be at least 2 characters.',
      }),
      args: z.array(z.string()).optional(),
    };
    let envSchema: Record<string, any> = {};
    if (pkg.environmentVariables && pkg.environmentVariables.length > 0) {
      const requiredNames = pkg.environmentVariables.filter((ev) => ev.isRequired).map((ev) => ev.name);
      // Use explicit key/value schemas for z.record and validate required keys via superRefine
      envSchema = z.record(z.string(), z.string()).superRefine((rec: Record<string, unknown>, ctx) => {
        requiredNames.forEach((name: string) => {
          const v = rec[name];
          if (typeof v !== 'string' || v.trim().length === 0) {
            ctx.addIssue({
              code: 'custom',
              message: `${name} is required`,
              path: [name],
            });
          }
        });
      });
    }
    return z.object({ ...baseShape, env: envSchema });
  }, [pkg.environmentVariables]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialPkgFormDefaults,
  });

  // Ensure form values reflect any saved user config that may arrive/change
  useEffect(() => {
    try {
      form.reset(initialPkgFormDefaults);
    } catch (e) {
      // ignore
    }
  }, [form, initialPkgFormDefaults]);

  // Watch the form values and memoize them so they can be accessed directly
  const watchedValues = useWatch({ control: form.control }) as z.infer<typeof formSchema> | undefined;
  const formValues = useMemo(() => {
    const config: IdeConfigPkg = { command: watchedValues?.command || '' };
    if (watchedValues?.args && watchedValues?.args.length > 0) config.args = watchedValues.args;
    if (watchedValues?.env && Object.keys(watchedValues.env).length > 0)
      config.env = watchedValues.env as Record<string, string>;
    // For Docker pkgs, if no args provided we provide sensible defaults
    if (pkg.registryType === 'oci' && (!config.args || config.args?.length === 0)) {
      config.args = [
        'run',
        '-i',
        '--rm',
        `${pkg.registryBaseUrl?.replace('https://', '') || 'docker.io'}/${pkg.identifier}:${pkg.version}`,
      ];
    }
    return config;
  }, [watchedValues, pkg.registryType, pkg.registryBaseUrl, pkg.identifier, pkg.version]);

  // Persist form changes to the stack (debounced) so user edits are saved as they type
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      try {
        // Only persist if this package is already in the user's stack.
        // This prevents the debounced autosave from re-adding the package after
        // the user has clicked "Remove from your stack".
        const currentlyInStack = getFromStack(item.server.name, 'package', pkgIndex);
        if (currentlyInStack) {
          addToStack(item.server.name, 'package', pkg, pkgIndex, formValues);
        }
      } catch (e) {
        // ignore
      }
    }, 500);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [addToStack, getFromStack, item.server.name, pkg, pkgIndex, formValues]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log('Submitted pkg form', values);
  }

  const packageUrl = getPkgUrl(pkg);

  return (
    <>
      <div className="space-y-6">
        {/* Package details */}
        <div className="flex gap-2 justify-center font-mono text-lg">
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
        <div>
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
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>⌨️ Command</FormLabel>
                  <FormControl>
                    <Input placeholder="Command to run the MCP server." required={true} {...field} />
                  </FormControl>
                  <FormDescription>Command to run the MCP server.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {pkg.environmentVariables && pkg.environmentVariables.length > 0 && (
              <div>
                <FormLabel>⚙️ Environment Variables</FormLabel>
                <div className="mt-3 space-y-4">
                  {pkg.environmentVariables.map((envVar: EnvVarOrHeader) => (
                    <FormField
                      key={envVar.name}
                      control={form.control}
                      name={`env.${envVar.name}`}
                      render={({ field }) => (
                        <div className="text-xs">
                          <div className="flex items-center gap-2">
                            <FormItem className="flex-1">
                              <FormLabel className="flex flex-wrap md:flex-nowrap">
                                <code>{envVar.name}</code>
                                {envVar.format && <Badge variant="outline">{envVar.format}</Badge>}{' '}
                                {envVar.isRequired && <span className="text-red-500">*</span>}{' '}
                                {envVar.isSecret && <span className="text-orange-500">🔒</span>}
                              </FormLabel>
                              <FormControl>
                                {envVar.isSecret ? (
                                  <PasswordInput
                                    required={envVar.isRequired}
                                    placeholder={envVar.default ?? envVar.name ?? ''}
                                    {...field}
                                  />
                                ) : (
                                  <Input
                                    required={envVar.isRequired}
                                    placeholder={envVar.default ?? envVar.name ?? ''}
                                    {...field}
                                  />
                                )}
                              </FormControl>
                              <FormDescription>{envVar.description}</FormDescription>
                            </FormItem>
                          </div>
                          {envVar.choices && envVar.choices.length > 0 && (
                            <div className="ml-4 mt-1 flex flex-wrap md:flex-nowrap gap-1">
                              {envVar.choices.map((choice: string) => (
                                <Badge key={choice} variant="secondary" className="text-xs px-1 py-0">
                                  {choice}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            {pkg.runtimeArguments && pkg.runtimeArguments.length > 0 && (
              <div>
                <span>⚡ Runtime Arguments</span>
                <div className="mt-2 space-y-2">
                  {pkg.runtimeArguments.map((arg: McpServerPackageArgument, aIndex: number) => (
                    <FormField
                      key={`rt-${aIndex}`}
                      name={`args.${aIndex}`}
                      control={form.control}
                      render={({ field }) => (
                        <div className="text-xs">
                          <div className="flex items-center gap-2">
                            <FormItem className="flex-1">
                              <FormLabel>
                                <code>{arg.name ?? arg.value ?? `arg-${aIndex}`}</code>
                                {arg.format && <Badge variant="outline">{arg.format}</Badge>}{' '}
                                {arg.isRequired && <Badge variant="destructive">required</Badge>}{' '}
                                {arg.isSecret && <span className="text-orange-500">🔒</span>}
                              </FormLabel>
                              {arg.format || arg.value ? (
                                <FormControl>
                                  <Input
                                    placeholder={arg.valueHint ?? arg.default ?? arg.description ?? ''}
                                    required={arg.isRequired}
                                    {...field}
                                  />
                                </FormControl>
                              ) : arg.type === 'named' ? (
                                // For named flags with no input, include a hidden native input bound to
                                // react-hook-form so the flag (arg.name) is part of the submitted args
                                // without the user having to type it.
                                <>
                                  {/* {console.log('NAMED ARG WITH NO INPUT (render branch)', { arg, field })} */}
                                  <FormControl>
                                    <Input type="hidden" {...field} />
                                  </FormControl>
                                </>
                              ) : null}
                              <FormDescription>{arg.description}</FormDescription>
                            </FormItem>
                          </div>

                          {arg.choices && arg.choices.length > 0 && (
                            <div className="ml-4 mt-1 flex flex-wrap md:flex-nowrap gap-1">
                              {arg.choices.map((choice: string) => (
                                <Badge key={choice} variant="secondary" className="text-xs px-1 py-0">
                                  {choice}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* TODO: pkg.packageArguments */}
            {/* Hidden submit button so pressing Enter in any input will submit the form */}
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        </Form>
      </div>

      {/* Actions buttons */}
      <div className="mt-3 flex flex-col gap-2 items-center">
        <div className="flex flex-wrap md:flex-nowrap gap-2 justify-center">
          <CopyButton
            variant="outline"
            size="sm"
            className="w-fit"
            content={JSON.stringify(formValues, null, 2)}
            onClick={async (e) => {
              e.stopPropagation();
              // Trigger validation but still allow copying; save whatever the user has entered before copying
              await form.trigger();
            }}
          >
            Copy server config
          </CopyButton>
          <Button
            className="w-fit"
            variant="outline"
            size="sm"
            onClick={() => {
              return getFromStack(item.server.name, 'package', pkgIndex)
                ? removeFromStack(item.server.name, 'package', pkgIndex)
                : addToStack(item.server.name, 'package', pkg, pkgIndex);
            }}
          >
            {getFromStack(item.server.name, 'package', pkgIndex) ? (
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

        {/* Buttons to install server in IDEs (VSCode, Cursor) */}
        <div className="flex flex-wrap md:flex-nowrap gap-2 justify-center">
          <a
            href={`vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: item.server.name, ...formValues }))}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="outline" size="sm">
              <img src={VscodeLogo} alt="VSCode" className="h-4 w-4" /> Install in VSCode
            </Button>
          </a>
          <a
            href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${item.server.name}&config=${encodeURIComponent(JSON.stringify(formValues))}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="outline" size="sm">
              <img src={CursorLogo} alt="Cursor" className="[filter:invert(0)] dark:[filter:invert(1)]" /> Install in
              Cursor
            </Button>
          </a>
        </div>
      </div>
    </>
  );
};

// NOTE: previous formSchema, that does not enable to validate env vars requiredness
// const formSchema = z.object({
//   command: z.string().min(2, {
//     message: 'Command to run the MCP server must be at least 2 characters.',
//   }),
//   args: z.array(z.string()).optional(),
//   env: z.record(z.string(), z.string()).optional(),
// });
