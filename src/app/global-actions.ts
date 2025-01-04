"use server";

import { destoryCookieSession } from "framework/server";

export function logoutAction() {
  destoryCookieSession();
}
