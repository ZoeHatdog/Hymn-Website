import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.BUCKET_NAME ?? "";
const region = process.env.BUCKET_REGION ?? "";

const client = new S3Client({
  region,
  credentials:
    process.env.BUCKET_ACCESS_KEY_ID && process.env.BUCKET_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.BUCKET_ACCESS_KEY_ID,
          secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY,
        }
      : undefined,
  endpoint: process.env.BUCKET_ENDPOINT || undefined,
});

export function isWebp(body: Buffer): boolean {
  return body.length > 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP";
}

export async function putImage(key: string, body: Buffer): Promise<void> {
  if (!bucket) {
    throw new Error("BUCKET_NAME is not set");
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/webp",
    }),
  );
}

export async function resolveImageUrl(value: string): Promise<string> {
  const path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!bucket) {
    throw new Error("BUCKET_NAME is not set");
  }

  const command = new GetObjectCommand({ Bucket: bucket, Key: path });
  return getSignedUrl(client, command, { expiresIn: 60 * 60 });
}
