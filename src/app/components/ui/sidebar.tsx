import { useLayoutEffect, useRef } from "react";
import { createFocusTrap } from "focus-trap";

import { cn } from "~/lib/utils";

export type SidebarContainerProps = React.ComponentProps<"div">;

export function SidebarContainer({
  className,
  ...props
}: SidebarContainerProps) {
  return (
    <div
      className={cn("relative overflow-hidden", "md:flex", className)}
      {...props}
    />
  );
}

export type SidebarProps = React.ComponentProps<"div"> & {
  collapsed?: boolean;
  onClose?: () => void;
  open?: boolean;
  side?: "left" | "right";
};

export function Sidebar({
  className,
  collapsed,
  onClose,
  open,
  side = "left",
  ...props
}: SidebarProps) {
  const elementRef = useFocusTrap(onClose);

  return (
    <div
      ref={elementRef}
      className={cn(
        "group absolute w-[var(--sidebar-width-mobile)] transition-all duration-200 top-0 h-full border-border md:overflow-hidden",
        "md:relative md:w-[var(--sidebar-width-desktop)] md:left-auto md:right-auto",
        side === "left"
          ? "-left-full data-[open]:left-0 md:data-[collapsed]:w-0"
          : "-right-full data-[open]:right-0 md:data-[collapsed]:w-0"
      )}
      data-collapsed={collapsed ? "" : undefined}
      data-open={open ? "" : undefined}
      onTransitionStart={handleTransitionStart}
      onTransitionEnd={handleTransitionEnd}
      onTransitionCancel={handleTransitionEnd}
    >
      <div
        className={cn(
          "z-10 absolute opacity-0 group-data-[open]:opacity-80 group-data-[open]:top-0 -left-full -top-full w-screen h-screen bg-background md:hidden transition-opacity delay-0 duration-0 group-data-[open]:delay-200 group-data-[open]:duration-300",
          side === "left"
            ? "group-data-[open]:left-0"
            : "group-data-[open]:right-0"
        )}
      />
      <div
        className={cn(
          "z-10 w-full md:w-[var(--sidebar-width-desktop)] absolute top-0 bottom-0 overflow-y-auto bg-background text-foreground group-data-[hidden]:hidden border-border",
          side === "left" ? "right-0 border-r-2" : "left-0 border-l-2",
          className
        )}
        {...props}
      />
    </div>
  );
}

export type SidebarMainProps = React.ComponentProps<"div">;

export function SidebarMain({ className, ...props }: SidebarMainProps) {
  return (
    <div
      className={cn(
        "absolute top-0 left-0 right-0 bottom-0 overflow-auto flex-1",
        "md:static",
        className
      )}
      {...props}
    />
  );
}

const BREAKPOINT = 768;

function useFocusTrap(onClose?: () => void) {
  const elementRef = useRef<
    HTMLDivElement & {
      focusTrap?: ReturnType<typeof createFocusTrap>;
    }
  >(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (!element.focusTrap) {
      element.focusTrap = createFocusTrap(element, {
        allowOutsideClick: true,
        escapeDeactivates: true,
        returnFocusOnDeactivate: true,
        onDeactivate() {
          onClose?.();
        },
      });
    }

    const elementRect = element.getBoundingClientRect();
    const parentRect = element.parentElement?.getBoundingClientRect();
    if (!parentRect) {
      throw new Error("Parent element not found");
    }
    if (
      elementRect.left < parentRect.left ||
      elementRect.right > parentRect.right ||
      element.clientWidth === 0
    ) {
      element.setAttribute("data-hidden", "");
      if (element.focusTrap?.active) {
        element.focusTrap.deactivate();
      }
    } else {
      element.removeAttribute("data-hidden");
      if (window.innerWidth < BREAKPOINT) {
        if (element.focusTrap && !element.focusTrap.active) {
          element.focusTrap.activate();
        }
      }
    }
  }, [onClose]);

  return elementRef;
}

function handleTransitionStart(event: React.TransitionEvent<HTMLDivElement>) {
  event.currentTarget.removeAttribute("data-hidden");
}

function handleTransitionEnd(
  event: React.TransitionEvent<
    HTMLDivElement & { focusTrap?: ReturnType<typeof createFocusTrap> }
  >
) {
  const element = event.currentTarget;
  const elementRect = element.getBoundingClientRect();
  const parentRect = element.parentElement?.getBoundingClientRect();
  if (!parentRect) {
    throw new Error("Parent element not found");
  }

  if (
    elementRect.left < parentRect.left ||
    elementRect.right > parentRect.right ||
    element.clientWidth === 0
  ) {
    element.setAttribute("data-hidden", "");
    if (element.focusTrap?.activate) {
      element.focusTrap.deactivate();
    }
  } else {
    element.removeAttribute("data-hidden");
    if (window.innerWidth < BREAKPOINT) {
      if (element.focusTrap && !element.focusTrap.active) {
        element.focusTrap.activate();
      }
    }
  }
}
