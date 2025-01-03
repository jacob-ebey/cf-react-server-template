import { cn } from "~/lib/utils";

export type SelectProps = React.ComponentProps<"select">;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "bg-background placeholder:text-foreground-muted text-foreground border-2 border-border p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
