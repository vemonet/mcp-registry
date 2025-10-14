import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '~/lib/utils';

export function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

// Hover-capable Popover: keeps API similar but exposes Trigger/Content that open on hover
const HoverPopoverContext = React.createContext<{
  setOpen: (v: boolean) => void;
  startClose: () => void;
  clearClose: () => void;
  openDelay: number;
  closeDelay: number;
} | null>(null);

export function Popover({
  children,
  openDelay = 100,
  closeDelay = 100,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root> & { openDelay?: number; closeDelay?: number }) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const startClose = React.useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    // schedule close after delay
    closeTimer.current = window.setTimeout(() => setOpen(false), closeDelay);
  }, [closeDelay]);

  const clearClose = React.useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  return (
    <HoverPopoverContext.Provider value={{ setOpen, startClose, clearClose, openDelay, closeDelay }}>
      <PopoverPrimitive.Root open={open} onOpenChange={(v) => setOpen(v)} {...props}>
        {children}
      </PopoverPrimitive.Root>
    </HoverPopoverContext.Provider>
  );
}

export function PopoverTrigger({ children, ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const ctx = React.useContext(HoverPopoverContext);
  if (!ctx) return <PopoverPrimitive.Trigger {...props}>{children}</PopoverPrimitive.Trigger>;

  const { setOpen, startClose, clearClose, openDelay } = ctx;

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    clearClose();
    // slight delay before opening to avoid accidental hovers
    window.setTimeout(() => setOpen(true), openDelay);
    // props may expect a more specific element type, cast to any to forward safely
    if (props.onMouseEnter) props.onMouseEnter(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    startClose();
    if (props.onMouseLeave) props.onMouseLeave(e);
  };

  return (
    <PopoverPrimitive.Trigger {...props} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
    </PopoverPrimitive.Trigger>
  );
}

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  alignOffset = 0,
  avoidCollisions = true,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const ctx = React.useContext(HoverPopoverContext);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    ctx?.clearClose();
    if (props.onMouseEnter) props.onMouseEnter(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    ctx?.startClose();
    if (props.onMouseLeave) props.onMouseLeave(e);
  };

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={collisionPadding}
        className={cn(
          'bg-popover text-popover-foreground z-50 w-72 overflow-auto origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden max-h-[var(--radix-popover-content-available-height)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
