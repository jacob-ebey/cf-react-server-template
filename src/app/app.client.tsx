"use client";

import { useNavigation } from "framework/client";

import { GlobalLoader } from "~/components/ui/global-loader";

export function GlobalPendingIndicator() {
  const navigation = useNavigation();

  return <GlobalLoader loading={navigation.state !== "idle"} />;
}
