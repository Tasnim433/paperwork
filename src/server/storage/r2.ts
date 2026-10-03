import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import { assertSafeKey, StorageConflictError, type Storage } from "./types";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** Cloudflare R2 through its S3 API, using the EU jurisdiction endpoint. */
export function createR2Storage(config: R2Config): Storage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.eu.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  return {
    async put(key, body, contentType) {
      assertSafeKey(key);
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            // Conditional write: fails if the object exists, so originals are never overwritten.
            IfNoneMatch: "*",
          }),
        );
      } catch (error) {
        if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412) {
          throw new StorageConflictError(key);
        }
        throw error;
      }
    },
    async get(key) {
      assertSafeKey(key);
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      if (!result.Body) throw new Error(`Empty object: ${key}`);
      return result.Body.transformToByteArray();
    },
    async delete(key) {
      assertSafeKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
