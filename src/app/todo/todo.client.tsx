"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Sidebar,
  SidebarContainer,
  SidebarMain,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";

export function Layout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState<boolean | undefined>(
    undefined
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <SidebarContainer className="flex-1 h-full w-full">
        <Sidebar
          collapsed={sidebarCollapsed}
          open={sidebarOpen}
          onClose={closeSidebar}
          className="z-30"
          style={{ viewTransitionName: "left-menu" }}
        >
          <header className="sticky top-0 bg-background p-4 md:px-6 border-b-2 border-border flex items-center md:hidden">
            <Button className="md:hidden" onPress={closeSidebar} size="icon">
              <span className="sr-only">Close sidebar</span>
              <PanelLeftClose />
            </Button>
          </header>
          {sidebar}
        </Sidebar>
        <SidebarMain className="flex flex-col overflow-hidden">
          <header
            className={cn(
              "z-20 sticky top-0 bg-background p-4 md:px-6 flex items-center border-b-2 border-border gap-4"
            )}
          >
            <Button
              className="md:hidden"
              onPress={() => setSidebarOpen((open) => !open)}
              size="icon"
            >
              <span className="sr-only">Toggle sidebar</span>
              {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
            <Button
              size="icon"
              className="hidden md:inline-flex"
              onPress={() => setSidebarCollapsed((open) => !open)}
            >
              <span className="sr-only">Toggle sidebar</span>
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </header>
          {children}
        </SidebarMain>
      </SidebarContainer>
    </div>
  );
}
