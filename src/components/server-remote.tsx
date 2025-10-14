import { Plus, Delete } from 'lucide-react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import type { IdeConfigRemote, IdeConfig, McpServerItem, McpServerRemote, StackItem } from '~/lib/types';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import VscodeLogo from '~/components/logos/vscode-logo.svg';
import CursorLogo from '~/components/logos/cursor-logo.svg';
import { CopyButton } from './ui/copy-button';
import { FormItem, FormLabel, FormControl, FormField, Form, FormDescription } from './ui/form';
import { Input } from './ui/input';
// useMemo already imported above
import { getRemoteIcon } from './server-utils';
import { PasswordInput } from './ui/password-input';

const formSchema = z.object({
  headers: z.record(z.string(), z.string()).optional(),
});

/** Display all details on a MCP server */
export const ServerRemote = ({
  item,
  remote,
  remoteIndex,
  addToStack,
  getFromStack,
  removeFromStack,
}: {
  item: McpServerItem;
  remote: McpServerRemote;
  remoteIndex: number;
  addToStack: (
    serverName: string,
    type: 'remote' | 'package',
    data: McpServerRemote,
    index: number,
    ideConfig?: IdeConfig
  ) => void;
  getFromStack: (serverName: string, type: 'remote' | 'package', index: number) => StackItem | null;
  removeFromStack: (serverName: string, type: 'remote' | 'package', index: number) => void;
}) => {
  // Build initial default values for the zod-based form using package metadata
  const stackEntry = getFromStack(item.server.name, 'remote', remoteIndex);
  const userConfig = stackEntry?.ideConfig as IdeConfigRemote | undefined;

  const initialFormDefaults = {
    headers:
      userConfig?.headers ??
      (remote.headers ? Object.fromEntries(remote.headers.map((ev) => [ev.name, ev.value ?? ev.default ?? ''])) : {}),
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormDefaults,
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log('SUBMIT REMOTE FORM', values);
  }

  // Watch the form values and memoize them so they can be accessed directly
  const watchedValues = useWatch({ control: form.control }) as z.infer<typeof formSchema> | undefined;
  const formValues = useMemo(() => {
    const config: IdeConfigRemote = { type: remote.type || '' };
    if (remote.url) config.url = remote.url;
    if (watchedValues?.headers && Object.keys(watchedValues.headers).length > 0) {
      config.headers = watchedValues.headers;
    }
    return config;
  }, [remote.type, remote.url, watchedValues]);

  // Memoize different string/encoded variants because we pass them to multiple props
  // and `JSON.stringify` / `encodeURIComponent` can be non-trivial for larger objects
  const formValuesPretty = useMemo(() => JSON.stringify(formValues, null, 2), [formValues]);
  const formValuesEncoded = useMemo(() => encodeURIComponent(JSON.stringify(formValues)), [formValues]);
  const vscodeInstallPayload = useMemo(
    () => JSON.stringify({ name: item.server.name, ...formValues }),
    [item.server.name, formValues]
  );

  // Persist form changes to the stack (debounced) so user edits are saved as they type
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      try {
        // Only persist if this remote is already in the user's stack.
        // This avoids the following UX issue: when the user clicks the "Remove from your
        // stack" button, the debounced autosave would re-add the entry immediately.
        // Check the current stack state at execution time to avoid race conditions.
        const currentlyInStack = getFromStack(item.server.name, 'remote', remoteIndex);
        if (currentlyInStack) {
          addToStack(item.server.name, 'remote', remote, remoteIndex, formValues);
        }
      } catch (e) {
        // ignore
      }
    }, 500);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [addToStack, getFromStack, item.server.name, remoteIndex, remote, /* formValues is memoized */ formValues]);

  return (
    <>
      {/* Remote server details */}
      <div className="space-y-4">
        <div className="flex gap-2 justify-center font-mono text-md">
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
        </div>
        <p>
          <span className="text-muted-foreground">🚛 Transport:</span> <code>{remote.type}</code>
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                                {header.isSecret && <span className="text-orange-500">🔒</span>}
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
      </div>

      {/* Actions buttons */}
      <div className="mt-3 flex flex-col gap-2 items-center">
        <div className="flex flex-wrap md:flex-nowrap gap-2 justify-center">
          <CopyButton
            variant="outline"
            size="sm"
            className="w-fit"
            content={formValuesPretty}
            // onClick={async (e) => {
            //   e.stopPropagation();
            // }}
          >
            Copy server config
          </CopyButton>
          {/* Save copied config into stack when copy succeeds */}
          <Button
            className="w-fit"
            variant="outline"
            size="sm"
            onClick={() => {
              return getFromStack(item.server.name, 'remote', remoteIndex)
                ? removeFromStack(item.server.name, 'remote', remoteIndex)
                : addToStack(item.server.name, 'remote', remote, remoteIndex);
            }}
          >
            {getFromStack(item.server.name, 'remote', remoteIndex) ? (
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

        <div className="flex flex-wrap md:flex-nowrap gap-2 justify-center">
          <a href={`vscode:mcp/install?${vscodeInstallPayload}`} onClick={(e) => e.stopPropagation()} className="flex">
            <Button variant="outline" size="sm">
              <img src={VscodeLogo} alt="VSCode" className="h-4 w-4" /> Install in VSCode
            </Button>
          </a>
          <a
            href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${item.server.name}&config=${formValuesEncoded}`}
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
