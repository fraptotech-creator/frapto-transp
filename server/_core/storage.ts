import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./env";

// MIME permitidos no upload. Bloqueia svg/html/xml/js (evita XSS servido pelo CDN).
export const ALLOWED_DOC_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

export function isStorageConfigured(): boolean {
  return Boolean(
    ENV.r2AccountId &&
      ENV.r2AccessKeyId &&
      ENV.r2SecretAccessKey &&
      ENV.r2BucketName
  );
}

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error("Storage (R2) não configurado.");
  }
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ENV.r2AccessKeyId,
        secretAccessKey: ENV.r2SecretAccessKey,
      },
    });
  }
  return _client;
}

// Sanitiza o nome do arquivo (anti path-traversal) e monta uma key por org.
export function buildObjectKey(orgId: number, fileName: string): string {
  const safe = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(-120);
  const rand = Math.random().toString(36).slice(2, 10);
  return `orgs/${orgId}/${Date.now()}-${rand}-${safe || "arquivo"}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

// URL assinada de download (expira). Força download (attachment) por segurança.
export async function getDownloadUrl(
  key: string,
  fileName?: string
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: ENV.r2BucketName,
    Key: key,
    ResponseContentDisposition: `attachment${fileName ? `; filename="${fileName.replace(/"/g, "")}"` : ""}`,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 300 });
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: ENV.r2BucketName, Key: key })
  );
}
