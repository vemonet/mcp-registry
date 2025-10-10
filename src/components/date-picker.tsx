import { Filter, X } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/components/ui/tooltip';
import { formatDate } from '~/lib/utils';

interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  variant?: 'outline' | 'default';
  className?: string;
}

export function DatePicker({ date, onDateChange, variant = 'outline', className = 'w-[280px]' }: DatePickerProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant={variant} size="default" className={className}>
              <Filter className="h-4 w-4" />
              {date && <span className="ml-2 text-xs">{formatDate(date)}</span>}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Filter by update date</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-auto p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Updated Since</h4>
            {date && (
              <Button variant="ghost" size="sm" onClick={() => onDateChange?.(undefined)} className="h-auto p-1">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={(date) => date > new Date()}
            autoFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
