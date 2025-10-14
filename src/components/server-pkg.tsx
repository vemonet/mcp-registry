import { z } from 'zod';
import { useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type {
  EnvVarOrHeader,
  IdeConfigPkg,
  McpServerItem,
  McpServerPkg,
  McpServerPkgArg,
  StackCtrl,
} from '~/lib/types';
import { Badge } from '~/components/ui/badge';
import { CopyButton } from './ui/copy-button';
import { FormItem, FormLabel, FormControl, FormField, Form, FormDescription, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { getPkgDefaultCmd, getPkgIcon, getPkgUrl } from './server-utils';
import { PasswordInput } from './ui/password-input';
import { ServerActionButtons } from './server-action-buttons';
import { DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

/** Display all details on a MCP server */
export const ServerPkg = ({
  item,
  pkg,
  pkgIndex,
  stackCtrl,
}: {
  item: McpServerItem;
  pkg: McpServerPkg;
  pkgIndex: number;
  stackCtrl: StackCtrl;
}) => {
  // If the user saved an ideConfig for this stack entry, use it as initial defaults
  const stackEntry = stackCtrl.getFromStack(item.server.name, 'package', pkgIndex);
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
      command: z.string().min(1, {
        message: 'Command to run the MCP server must be at least 1 character.',
      }),
      args: z.array(z.string()).optional(),
    };
    let envSchema = z.record(z.string(), z.string());
    if (pkg.environmentVariables && pkg.environmentVariables.length > 0) {
      const requiredNames = pkg.environmentVariables.filter((ev) => ev.isRequired).map((ev) => ev.name);
      if (requiredNames.length > 0) {
        // Use explicit key/value schemas for z.record and validate required keys via superRefine
        envSchema = envSchema.superRefine((rec: Record<string, unknown>, ctx) => {
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
    }
    return z.object({ ...baseShape, env: envSchema });
  }, [pkg.environmentVariables]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialPkgFormDefaults,
  });

  // Ensure form values reflect any saved user config that may arrive/change
  useEffect(() => {
    const currentValues = form.getValues();
    const isSame = JSON.stringify(currentValues) === JSON.stringify(initialPkgFormDefaults);
    if (!isSame) {
      try {
        form.reset(initialPkgFormDefaults);
      } catch (e) {}
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
        const currentlyInStack = stackCtrl.getFromStack(item.server.name, 'package', pkgIndex);
        if (currentlyInStack) {
          stackCtrl.addToStack(item.server.name, 'package', pkg, pkgIndex, formValues);
        }
      } catch (e) {
        /* ignore */
      }
    }, 500);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [item.server.name, pkg, pkgIndex, formValues, stackCtrl]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log('Submitted pkg form', values);
  }

  const packageUrl = getPkgUrl(pkg);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex gap-2">
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
        </DialogTitle>
        {/* <DialogDescription></DialogDescription> */}
      </DialogHeader>
      <div className="space-y-6">
        {/* Package details */}
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                              <FormMessage />
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
                  {pkg.runtimeArguments.map((arg: McpServerPkgArg, aIndex: number) => (
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
                              <FormMessage />
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
      <ServerActionButtons
        item={item}
        endpoint={pkg}
        endpointIndex={pkgIndex}
        formValues={formValues}
        stackCtrl={stackCtrl}
        onClickCopy={async (e) => {
          e.stopPropagation();
          await form.trigger();
        }}
      />
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
