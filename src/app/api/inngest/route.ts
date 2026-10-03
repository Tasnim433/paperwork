import { serve } from "inngest/next";

import { inngest } from "@/server/inngest/client";
import { functions } from "@/server/inngest/functions";

// OCR and AI calls can take a while.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
