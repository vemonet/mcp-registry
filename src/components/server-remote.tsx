import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import type { McpIdeConfigRemote, McpServerItem, McpServerRemote, StackCtrl } from '~/lib/types';
import { Badge } from '~/components/ui/badge';
import { CopyButton } from './ui/copy-button';
import { FormItem, FormLabel, FormControl, FormField, Form, FormDescription, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { getRemoteIcon } from './server-utils';
import { PasswordInput } from './ui/password-input';
import { ServerActionButtons } from './server-action-buttons';
import { DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

/** Display all details on a MCP server */
export const ServerRemote = ({
  item,
  remote,
  remoteIndex,
  stackCtrl,
}: {
  item: McpServerItem;
  remote: McpServerRemote;
  remoteIndex: number;
  stackCtrl: StackCtrl;
}) => {
  // Build initial default values for the zod-based form using package metadata
  const stackEntry = stackCtrl.getFromStack(item.server.name, 'remote', remoteIndex);
  const userConfig = stackEntry?.ideConfig as McpIdeConfigRemote | undefined;

  const initialFormDefaults = {
    headers:
      userConfig?.headers ??
      (remote.headers ? Object.fromEntries(remote.headers.map((ev) => [ev.name, ev.value ?? ev.default ?? ''])) : {}),
  };

  // Build a per-remote zod schema so we can mark remote-declared headers as required
  const formSchema = useMemo(() => {
    let headersSchema = z.record(z.string(), z.string());
    if (remote.headers && remote.headers.length > 0) {
      const requiredNames = remote.headers.filter((h) => h.isRequired).map((h) => h.name);
      if (requiredNames.length > 0) {
        // Use explicit key/value schemas for z.record and validate required keys via superRefine
        headersSchema = headersSchema.superRefine((rec: Record<string, unknown>, ctx) => {
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
    return z.object({ headers: headersSchema });
  }, [remote.headers]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormDefaults,
  });

  // Watch the form values and memoize them so they can be accessed directly
  const watchedValues = useWatch({ control: form.control }) as z.infer<typeof formSchema> | undefined;
  const formValues = useMemo(() => {
    const config: McpIdeConfigRemote = { type: remote.type || '' };
    if (remote.url) config.url = remote.url;
    if (watchedValues?.headers && Object.keys(watchedValues.headers).length > 0) {
      config.headers = watchedValues.headers;
    }
    return config;
  }, [remote.type, remote.url, watchedValues]);

  // Persist form changes to the stack (debounced) so user edits are saved as they type
  useEffect(() => {
    let t = setTimeout(() => {
      try {
        const currentlyInStack = stackCtrl.getFromStack(item.server.name, 'remote', remoteIndex);
        if (currentlyInStack) {
          stackCtrl.addToStack(item.server.name, 'remote', remote, remoteIndex, formValues);
        }
      } catch (e) {}
    }, 500);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [item.server.name, remoteIndex, remote, formValues, stackCtrl]);

  function onSubmit(_values: z.infer<typeof formSchema>) {
    // console.log('Submit remote form', values);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex gap-2">
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
        </DialogTitle>
        <DialogDescription className="mt-2">
          <span>🚛 Transport:</span> <code className="text-primary">{remote.type}</code>
        </DialogDescription>
      </DialogHeader>
      {/* Remote server details */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {remote.headers && remote.headers.length > 0 && (
            <div>
              <span className="text-muted-foreground">⚙️ Headers:</span>
              <div className="mt-2 space-y-2">
                {remote.headers.map((header) => (
                  <FormField
                    key={header.name}
                    control={form.control}
                    name={`headers.${header.name}`}
                    render={({ field }) => (
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <FormItem className="flex-1">
                            <FormLabel>
                              <code>{header.name}</code>
                              {header.format && <Badge variant="outline">{header.format}</Badge>}{' '}
                              {header.isRequired && <span className="text-red-500">*</span>}{' '}
                              {header.isSecret && <span>🔒</span>}
                            </FormLabel>
                            <FormControl>
                              {header.isSecret ? (
                                <PasswordInput
                                  required={header.isRequired}
                                  placeholder={header.default ?? header.name ?? ''}
                                  {...field}
                                />
                              ) : (
                                <Input
                                  required={header.isRequired}
                                  placeholder={header.default ?? header.name ?? ''}
                                  {...field}
                                />
                              )}
                            </FormControl>
                            <FormDescription>{header.description}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        </div>
                        {header.choices && header.choices.length > 0 && (
                          <div className="ml-4 mt-1 flex flex-wrap md:flex-nowrap gap-1">
                            {header.choices.map((choice: string) => (
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
          {/* Hidden submit button so pressing Enter in any input will submit the form */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Form>

      {/* Actions buttons (copy config, install in clients) */}
      <ServerActionButtons
        item={item}
        endpoint={remote}
        endpointIndex={remoteIndex}
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
