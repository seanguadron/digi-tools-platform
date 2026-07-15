// Minimal, dependency-free ZIP writer using the "store" method (no compression).
// PNG layers are already DEFLATE-compressed, so re-deflating them would add a
// dependency for almost no size win — storing them keeps the app at zero new
// runtime deps (AGENTS.md Rule 17) while still producing a standard .zip that
// every OS unpacker accepts. Text manifests are stored verbatim too.

export interface ZipEntry {
  name: string; // path inside the archive, forward slashes
  data: Uint8Array;
}

// CRC-32 (IEEE 802.3), computed with a lazily-built lookup table.
let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    crcTable = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pack a JS Date into the DOS date/time fields ZIP headers use (2-second
// resolution; epoch 1980). Runs in browser app code, so `new Date()` is fine.
function toDosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  return { time: dosTime & 0xffff, date: dosDate & 0xffff };
}

// Build a stored (uncompressed) .zip Blob from the given entries. Filenames are
// written UTF-8 with the language-encoding flag set so non-ASCII names survive.
// Uses 32-bit sizes/offsets (no ZIP64) — assumes a total archive under 4 GB,
// which the editor's layer caps (≤64 doc-sized PNGs) never approach.
export function createZip(entries: ZipEntry[], now = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, date } = toDosDateTime(now);
  const chunks: Uint8Array[] = []; // local headers + file data, in order
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(local.buffer);
    ldv.setUint32(0, 0x04034b50, true); // local file header signature
    ldv.setUint16(4, 20, true); // version needed to extract (2.0)
    ldv.setUint16(6, 0x0800, true); // flags: bit 11 = UTF-8 filename
    ldv.setUint16(8, 0, true); // compression method: 0 = store
    ldv.setUint16(10, time, true);
    ldv.setUint16(12, date, true);
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, size, true); // compressed size (== uncompressed)
    ldv.setUint32(22, size, true); // uncompressed size
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true); // extra field length
    local.set(nameBytes, 30);
    chunks.push(local, entry.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true); // central directory header signature
    cdv.setUint16(4, 20, true); // version made by
    cdv.setUint16(6, 20, true); // version needed
    cdv.setUint16(8, 0x0800, true); // flags
    cdv.setUint16(10, 0, true); // method: store
    cdv.setUint16(12, time, true);
    cdv.setUint16(14, date, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true); // extra length
    cdv.setUint16(32, 0, true); // comment length
    cdv.setUint16(34, 0, true); // disk number start
    cdv.setUint16(36, 0, true); // internal attributes
    cdv.setUint32(38, 0, true); // external attributes
    cdv.setUint32(42, offset, true); // relative offset of local header
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  }

  const centralSize = central.reduce((total, c) => total + c.length, 0);
  const centralOffset = offset;

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true); // end of central directory signature
  edv.setUint16(4, 0, true); // this disk number
  edv.setUint16(6, 0, true); // disk with central directory
  edv.setUint16(8, entries.length, true); // entries on this disk
  edv.setUint16(10, entries.length, true); // total entries
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, centralOffset, true);
  edv.setUint16(20, 0, true); // comment length

  // Hand the chunks straight to Blob (it copies once internally) rather than
  // pre-concatenating into a second full buffer. A bare Uint8Array is a valid
  // BlobPart at runtime; the cast sidesteps TS's over-strict ArrayBufferLike vs
  // ArrayBuffer BlobPart typing without an extra copy.
  const parts = [...chunks, ...central, eocd] as unknown as BlobPart[];
  return new Blob(parts, { type: "application/zip" });
}

// Convenience: a UTF-8 text entry (for JSON / Markdown manifests).
export function textZipEntry(name: string, contents: string): ZipEntry {
  return { name, data: new TextEncoder().encode(contents) };
}
