import { cron } from "inngest";

import { describeError } from "@/lib/errors";

import { errorCode, nonRetriable, withRateLimitRetry } from "../pipeline/errors";
import {
  classify,
  extract,
  markFailed,
  recognizeText,
  setStage,
  summarize,
  validate,
} from "../pipeline/stages";
import { purgeExpiredHistory } from "../retention";
import { documentUploaded, inngest } from "./client";

/**
 * Processing pipeline for an uploaded document. Each stage is its own step:
 * finished steps are not repeated when a later one is retried.
 */
export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    triggers: [documentUploaded],
    retries: 3,
    // Stay within free-tier AI rate limits.
    concurrency: { limit: 2 },
    onFailure: async ({ event, error }) => {
      const ref = event.data.event.data;
      await markFailed(ref, errorCode(error), describeError(error));
    },
  },
  async ({ event, step, attempt }) => {
    const ref = event.data;

    await step.run("text-recognition", async () => {
      await setStage(ref, "text_recognition");
      return recognizeText(ref).catch(nonRetriable);
    });

    await step.run("classification", async () => {
      await setStage(ref, "classification");
      return withRateLimitRetry(attempt, () => classify(ref));
    });

    await step.run("extraction", async () => {
      await setStage(ref, "extraction");
      return withRateLimitRetry(attempt, () => extract(ref));
    });

    const validation = await step.run("validation", async () => {
      await setStage(ref, "validation");
      return validate(ref);
    });

    await step.run("summary", async () => {
      await setStage(ref, "summary");
      return withRateLimitRetry(attempt, () => summarize(ref));
    });

    return { documentId: ref.documentId, flagged: validation.flagged };
  },
);

/**
 * Daily: removes history log entries older than each user's retention setting
 * (3, 6 or 12 months; 0 keeps everything). Users without settings get the default.
 */
export const purgeHistory = inngest.createFunction(
  { id: "purge-history", triggers: [cron("TZ=Europe/Berlin 0 3 * * *")], retries: 3 },
  async ({ step }) => {
    const removed = await step.run("purge-expired-entries", () => purgeExpiredHistory(new Date()));
    return { removed };
  },
);

export const functions = [processDocument, purgeHistory];
