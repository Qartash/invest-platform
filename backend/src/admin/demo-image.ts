import { deflateSync } from 'zlib';

/**
 * A PNG encoder, just large enough to give demo projects real image files.
 *
 * The alternative was checking binary fixtures into the repository or fetching
 * placeholders from an image host at seed time; one bloats the clone and the other
 * makes seeding fail whenever that host is down or the server has no outbound
 * network. A gradient is a hundred lines of arithmetic and always works.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

export type Rgb = [number, number, number];

/**
 * A diagonal two-colour gradient, `width` by `height`, as PNG bytes.
 *
 * Truecolour (no alpha, no palette) with every scanline on filter 0 — the encoder
 * does no filtering at all, which costs a few kilobytes and saves the code that
 * would choose between five filter types for an image nobody will zoom into.
 */
export function gradientPng(width: number, height: number, from: Rgb, to: Rgb): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      // Halfway along each axis, so the corners are the two pure colours.
      const t = (x / (width - 1) + y / (height - 1)) / 2;
      raw[offset++] = Math.round(from[0] + (to[0] - from[0]) * t);
      raw[offset++] = Math.round(from[1] + (to[1] - from[1]) * t);
      raw[offset++] = Math.round(from[2] + (to[2] - from[2]) * t);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
