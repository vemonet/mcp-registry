import { Plus, Delete } from 'lucide-react';

import type {
  IdeConfigPkg,
  IdeConfigRemote,
  McpServerItem,
  McpServerPkg,
  McpServerRemote,
  StackCtrl,
} from '~/lib/types';
import { Button } from '~/components/ui/button';
import VscodeLogo from '~/components/logos/vscode-logo.svg';
import CursorLogo from '~/components/logos/cursor-logo.svg';
import { CopyButton } from './ui/copy-button';
import { useMemo } from 'react';

/** Display action buttons for a MCP server access point (copy config, install VSCode/Cursor) */
export const ServerActionButtons = ({
  item,
  endpoint,
  endpointIndex,
  formValues,
  stackCtrl,
  onClickCopy,
}: {
  formValues: IdeConfigPkg | IdeConfigRemote;
  item: McpServerItem;
  endpoint: McpServerPkg | McpServerRemote;
  endpointIndex: number;
  stackCtrl: StackCtrl;
  onClickCopy?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  const formValuesPretty = useMemo(() => JSON.stringify(formValues, null, 2), [formValues]);
  const formValuesEncoded = useMemo(() => encodeURIComponent(JSON.stringify(formValues)), [formValues]);
  const vscodeInstallPayload = useMemo(
    () => JSON.stringify({ name: item.server.name, ...formValues }),
    [item.server.name, formValues]
  );

  const endpointType = (endpoint as McpServerPkg).identifier ? 'package' : 'remote';

  return (
    <div className="flex flex-col gap-2 items-center">
      {/* Copy config and add to stack buttons */}
      <div className="flex flex-wrap md:flex-nowrap gap-2 justify-center">
        <CopyButton
          variant="outline"
          size="sm"
          className="w-fit"
          content={formValuesPretty}
          {...(onClickCopy && { onClick: onClickCopy })}
        >
          Copy server config
        </CopyButton>
        <Button
          className="w-fit"
          variant="outline"
          size="sm"
          onClick={() => {
            return stackCtrl.getFromStack(item.server.name, endpointType, endpointIndex)
              ? stackCtrl.removeFromStack(item.server.name, endpointType, endpointIndex)
              : stackCtrl.addToStack(item.server.name, endpointType, endpoint, endpointIndex);
          }}
        >
          {stackCtrl.getFromStack(item.server.name, endpointType, endpointIndex) ? (
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

      {/* Client installation buttons */}
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
  );
};
