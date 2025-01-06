"use client";

import { useNavigating } from "framework/client";

import { GlobalLoader } from "~/components/ui/global-loader";

export function GlobalPendingIndicator() {
  const navigating = useNavigating();

  return <GlobalLoader loading={navigating} />;
}
