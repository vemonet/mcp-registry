import * as React from 'react';

import { cn } from '~/lib/utils';

const errorColor = 'destructive';
// const errorColor = 'orange-400';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        `aria-invalid:ring-${errorColor}/20 dark:aria-invalid:ring-${errorColor}/40 aria-invalid:border-${errorColor}`,
        className
      )}
      {...props}
    />
  );
}

export { Input };
