import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AppError } from "@/lib/app-error";
import { LOGO_ALLOWED_MIME_TYPES, LOGO_MAX_FILE_SIZE_BYTES } from "@/constants/company";
import { sanitizeSvg } from "@/modules/company/services/svg-sanitizer";

const LOGO_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "logos");
const LOGO_PUBLIC_PATH_PREFIX = "/uploads/logos";

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/svg+xml": ".svg",
};

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

export async function saveCompanyLogo(file: File): Promise<string> {
  if (!LOGO_ALLOWED_MIME_TYPES.includes(file.type as (typeof LOGO_ALLOWED_MIME_TYPES)[number])) {
    throw new AppError("Logo must be a PNG, JPG, JPEG, or SVG file.");
  }

  if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
    throw new AppError("Logo must be smaller than 5 MB.");
  }

  await mkdir(LOGO_UPLOAD_DIR, { recursive: true });

  const fileName = `${randomUUID()}${EXTENSION_BY_MIME_TYPE[file.type]}`;
  let buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "image/svg+xml") {
    buffer = Buffer.from(sanitizeSvg(buffer.toString("utf-8")), "utf-8");
  }

  await writeFile(path.join(LOGO_UPLOAD_DIR, fileName), buffer);

  return `${LOGO_PUBLIC_PATH_PREFIX}/${fileName}`;
}

/**
 * Reads a stored Company Logo (the public path `Company.logo` holds, e.g.
 * `/uploads/logos/<uuid>.png`) off local disk and returns it as a base64
 * data URI — PDF generation (78-pdf-generation.md's Assets rule) needs
 * every asset self-contained, never an external/local file `<img src>` URL
 * Puppeteer would have to resolve separately. Only the basename is ever
 * joined onto `LOGO_UPLOAD_DIR` (never the raw stored path), so a
 * corrupted/tampered `Company.logo` value can't escape the upload
 * directory. Returns `null` — never throws — for an empty path, an
 * unrecognized extension, or a file that can't be read, since a
 * missing/corrupt logo must not break PDF generation.
 */
export async function readCompanyLogoAsDataUri(logoPath: string | null): Promise<string | null> {
  if (!logoPath) {
    return null;
  }

  const fileName = path.basename(logoPath);
  const extension = path.extname(fileName).toLowerCase();
  const mimeType = MIME_TYPE_BY_EXTENSION[extension];
  if (!mimeType) {
    return null;
  }

  try {
    const buffer = await readFile(path.join(LOGO_UPLOAD_DIR, fileName));
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
