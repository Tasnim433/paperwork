import { createAuthClient } from "better-auth/react";

/** Uses the current origin, so it works on localhost and LAN addresses alike. */
export const authClient = createAuthClient();
