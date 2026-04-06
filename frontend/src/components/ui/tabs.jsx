import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

export function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root className={cn('w-full', className)} {...props} />;
}

export function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-11 items-center justify-start gap-1 rounded-xl bg-[#F4F4F4] p-1 border-2 border-[#E0E0E0]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all',
        'text-[#555555] hover:text-[#0D0D0D]',
        'data-[state=active]:bg-[#0D0D0D] data-[state=active]:text-[#FFFF66] data-[state=active]:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87CEEB]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 focus-visible:outline-none animate-fadeUp', className)}
      {...props}
    />
  );
}
