import { Loader2Icon } from 'lucide-react';

import { cn } from '~/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      // Use explicit Tailwind height/width so the icon doesn't stretch to full width
      className={cn('h-4 w-4 animate-spin', className)}
      {...props}
    />
  );
}
// size-4

export { Spinner };
