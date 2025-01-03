import { cn } from "~/lib/utils";

export type CheckboxProps = React.ComponentProps<"input">;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-5 w-5 bg-background placeholder:text-foreground-muted text-foreground border-2 border-border p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
