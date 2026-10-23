import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const size = 512;
const px = Buffer.alloc(size * size * 4);
const set = (x, y, [r, g, b, a = 255]) => {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
};
const radius = 96;
const inside = (x, y) => {
  const cx = Math.max(radius - x, 0, x - (size - radius - 1));
  const cy = Math.max(radius - y, 0, y - (size - radius - 1));
  return cx * cx + cy * cy <= radius * radius;
};
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  if (!inside(x, y)) continue;
  const edge = !inside(x - 6, y) || !inside(x + 6, y) || !inside(x, y - 6) || !inside(x, y + 6);
  set(x, y, edge ? [76, 194, 165] : [23, 30, 37]);
}
// Prompt `>` e underscore in teal.
const teal = [76, 194, 165];
const thick = 22;
for (let i = 0; i < 92; i++) for (let t = 0; t < thick; t++) {
  set(150 + i, 186 + i + t, teal);
  set(150 + i, 370 - i + t, teal);
}
for (let x = 270; x < 390; x++) for (let y = 360; y < 382; y++) set(x, y, teal);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
const crc32 = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = path.resolve('apps/desktop/build/icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(out, png.length);
