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

export const functions = [processDocument];
