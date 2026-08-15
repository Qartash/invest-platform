import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/**
 * How an uploaded file is named and what it is allowed to be.
 *
 * Every upload route used to build its own name out of the request: `${req.params.id}-` +
 * a timestamp + `extname(file.originalname)`. Both halves of that come from the caller.
 * Express hands `req.params` back percent-decoded, so a request to
 * `POST /api/projects/%2e%2e%2f%2e%2e%2fx/cover-image` arrives with `id` equal to `../../x`,
 * multer joins that onto the destination, and the file lands outside `uploads/` entirely —
 * anywhere the process can write, with an extension the caller also chose. Nothing about the
 * upload has to be valid for that to work; a project id that matches no project writes the
 * file just the same, because the name is decided before any handler runs.
 *
 * So the name is ours now: a random UUID plus an extension looked up from the *accepted*
 * content type. Nothing the caller sends reaches the path, and there is no separator, no dot
 * segment and no length for them to play with.
 */

/**
 * Images we are willing to store, and what each is called on disk.
 *
 * SVG is missing on purpose, and its absence is the point: it is an image to a file picker
 * and a document with scripts in it to a browser. `uploads/` is served straight off the API
 * origin, so an SVG uploaded as an avatar is a script running there — stored XSS on the same
 * host that answers every authenticated request. The rest of these are inert whatever a
 * browser decides they are.
 */
export const IMAGE_UPLOAD_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

/** Documents a founder can attach to a project, plus the two image types worth attaching. */
export const ATTACHMENT_UPLOAD_TYPES: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/**
 * The stored name for a file of this type: random, unguessable, and carrying nothing the
 * caller wrote. Exported so it can be tested on its own — a name that ever contains a path
 * separator or a dot segment is the bug this module exists to prevent.
 */
export function storedFileName(mimeType: string, accepted: Readonly<Record<string, string>>): string {
  // Own properties only. A plain lookup answers for `constructor` and `toString` as well,
  // and an extension of "function Object() { ... }" is not something to find out about at
  // the point where a path is being built.
  const extension = Object.prototype.hasOwnProperty.call(accepted, mimeType) ? accepted[mimeType] : undefined;
  if (!extension) {
    // Unreachable through the filter below, which rejects first. Kept as a hard stop so a
    // future caller cannot get an extension-less name written to disk by passing a type
    // that was never on the list.
    throw new BadRequestException('Unsupported file type');
  }
  return `${randomUUID()}${extension}`;
}

// Control characters and the invisible formatting ones, which is where the bidirectional
// overrides live: a right-to-left override turns "invoice<RLO>gnp.exe" into something that
// reads as "invoiceexe.png" on screen while still being an .exe on the other end.
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

/**
 * The name to *show*, taken from what the uploader called the file.
 *
 * Only ever displayed, never joined onto a path — but it still arrives from the client, so
 * it is reduced to its last segment the way a path would be, loses leading dots and anything
 * invisible, and is cut to a length a column and a screen can both hold. Some browsers do
 * send a whole path here, which is the honest reason for the first step as well as the
 * defensive one.
 */
export function displayFileName(originalName: string): string {
  const lastSegment = originalName.split(/[\\/]/).pop() ?? '';
  const flattened = lastSegment.replace(INVISIBLE_CHARACTERS, '').replace(/^\.+/, '').trim();
  return flattened.slice(0, 200) || 'file';
}

/**
 * Multer options for one upload route. `accept` is both the filter and the extension table,
 * so a type can never be allowed in without a decision having been made about what it is
 * called on disk.
 */
export function uploadOptions(options: {
  destination: string;
  accept: Readonly<Record<string, string>>;
  maxBytes: number;
}): MulterOptions {
  const { destination, accept, maxBytes } = options;
  return {
    storage: diskStorage({
      destination,
      filename: (_req, file, cb) => {
        try {
          cb(null, storedFileName(file.mimetype, accept));
        } catch (error) {
          cb(error as Error, '');
        }
      },
    }),
    fileFilter: (_req, file, cb) => {
      // The declared type is the caller's word, and it decides only what we are willing to
      // store and what we call it — never where it goes. A PNG full of HTML is still written
      // as .png and still served as an image; the extension is what a browser listens to,
      // and the nosniff header in main.ts is what stops it guessing otherwise.
      if (!Object.prototype.hasOwnProperty.call(accept, file.mimetype)) {
        return cb(new BadRequestException('Unsupported file type'), false);
      }
      cb(null, true);
    },
    // `files` matters as much as `fileSize`: without it one request can carry any number of
    // parts, each under the size limit and every one of them written to disk.
    limits: { fileSize: maxBytes, files: 1 },
  };
}
