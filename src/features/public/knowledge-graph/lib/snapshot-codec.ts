/**
 * The snapshot's wire format.
 *
 * JSON was costing more than twice what the data needs. Numbers written as
 * text average about three and a half bytes each and compress poorly, and the
 * edge list -- four numbers per edge, fifteen thousand edges -- was nearly half
 * the file on its own.
 *
 * Three things do the work here:
 *
 *   TYPED ARRAYS. A community id is two bytes, a node type is one, an offset is
 *   one. Written as JSON they were five, three and six.
 *
 *   NODES REINDEXED BY COMMUNITY, done by the generator before encoding. That
 *   makes the community column monotonic -- runs of one repeated value, which
 *   brotli reduces to nothing -- and it makes edge endpoints local, because
 *   most edges join nodes in the same community and their indices are now
 *   adjacent. The edge list gets most of its win from this rather than from the
 *   encoding.
 *
 *   DELTA-VARINT SOURCES. With the edge list sorted by source, the source
 *   column is a run of small increments; a varint spends one byte on almost all
 *   of them instead of four.
 *
 * Encoder and decoder live together on purpose: they are one format, and a
 * format whose two halves live in different files is a format that will
 * eventually disagree with itself.
 */

export const SNAPSHOT_MAGIC = 0x50424b47; // "PBKG"
export const SNAPSHOT_FORMAT = 1;

/** Everything the cloud needs, already in the shapes it will use. */
export interface DecodedSnapshot {
  built: string;
  organs: string[];
  chapters: string[];
  /** Per node, all in community order. */
  labels: string[];
  type: Uint8Array;
  /** Index into `organs`, or -1. */
  organ: Int16Array;
  /** Index into `chapters`, or -1. */
  chapter: Int16Array;
  community: Uint16Array;
  /** Unit-ball position inside the node's own community, 3 per node. */
  offsets: Float32Array;
  /** Per edge. */
  edgeSource: Int32Array;
  edgeTarget: Int32Array;
  /** Edge kind index, and result index, packed as kind * 9 + result. */
  edgeCode: Uint8Array;
  /**
   * 1 where the edge's original source is `edgeTarget` rather than `edgeSource`.
   *
   * Pairs are normalised low-to-high so the target column deltas well, which
   * loses the direction the database recorded. On a subtype edge that direction
   * is the whole meaning -- source is the child, target is the parent -- so it
   * is kept in a spare bit of the code byte rather than a column of its own.
   */
  edgeFlipped: Uint8Array;
  /** Communities in seating order, and the family each belongs to. */
  order: Int32Array;
  family: Int32Array;
}

export interface EncodeInput {
  built: string;
  organs: string[];
  chapters: string[];
  labels: string[];
  type: number[];
  organ: number[];
  chapter: number[];
  community: number[];
  /** Unit-ball offsets, 3 per node, in the range the layout produces. */
  offsets: number[];
  /** Flat quads: source, target, kind, result. */
  edges: number[];
  order: number[];
  family: number[];
}

/**
 * Offsets are a unit ball clamped to +/-1.6 and then scaled by a cluster
 * radius of at most a few hundred units inside a globe a thousand across, so a
 * single byte per axis is a worst-case error under a pixel. int16 cost eight
 * more kilobytes to encode a precision nothing can display.
 */
const OFFSET_QUANT = 79; // 1.6 * 79 ≈ 126, inside a signed byte
/** Bit in the edge code marking that the pair was reordered when normalised. */
const FLIPPED = 0x40;

function writeVarint(out: number[], value: number) {
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

export function encodeSnapshot(input: EncodeInput): Uint8Array {
  const n = input.labels.length;
  const m = input.edges.length / 4;

  /* Sorted by source so the source column deltas to small numbers. The pair is
   * normalised low-to-high first: an edge is undirected here, and leaving the
   * order as the database happened to produce it would scatter the sort. */
  const quads: [number, number, number][] = [];
  for (let k = 0; k < m; k++) {
    const a = input.edges[k * 4];
    const b = input.edges[k * 4 + 1];
    // kind * 9 + result never exceeds 53, so bit 6 is free for the direction.
    const code = input.edges[k * 4 + 2] * 9 + input.edges[k * 4 + 3];
    quads.push([Math.min(a, b), Math.max(a, b), a > b ? code | FLIPPED : code]);
  }
  quads.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

  /* Both columns are deltas. Sorted by (source, target), the source column is a
   * run of small increments and -- within one source -- so is the target
   * column, because the pair was normalised low-to-high before sorting. Written
   * as absolute 16-bit targets this was the second largest thing in the file;
   * as deltas most of them fit in a single byte. */
  const src: number[] = [];
  const tgt: number[] = [];
  const code = new Uint8Array(m);
  let prevSource = 0;
  let prevTarget = 0;
  quads.forEach(([a, b, c], i) => {
    writeVarint(src, a - prevSource);
    if (a !== prevSource) prevTarget = a;
    writeVarint(tgt, b - prevTarget);
    prevSource = a;
    prevTarget = b;
    code[i] = c;
  });

  const header = JSON.stringify({
    built: input.built,
    organs: input.organs,
    chapters: input.chapters,
    n,
    m,
    srcBytes: src.length,
    tgtBytes: tgt.length,
    communities: input.order.length,
  });
  const headerBytes = new TextEncoder().encode(header);
  const labelBytes = new TextEncoder().encode(input.labels.join("\n"));

  const parts: Uint8Array[] = [];
  const prefix = new DataView(new ArrayBuffer(16));
  prefix.setUint32(0, SNAPSHOT_MAGIC);
  prefix.setUint32(4, SNAPSHOT_FORMAT);
  prefix.setUint32(8, headerBytes.length);
  prefix.setUint32(12, labelBytes.length);
  parts.push(new Uint8Array(prefix.buffer), headerBytes, labelBytes);

  parts.push(Uint8Array.from(input.type));
  // +1 so "none" is 0 and the column stays unsigned and one byte wide.
  parts.push(Uint8Array.from(input.organ, (v) => v + 1));
  parts.push(Uint8Array.from(input.chapter, (v) => v + 1));
  parts.push(new Uint8Array(Uint16Array.from(input.community).buffer));
  parts.push(new Uint8Array(Int8Array.from(input.offsets, (v) => Math.round(v * OFFSET_QUANT)).buffer));
  parts.push(Uint8Array.from(src));
  parts.push(Uint8Array.from(tgt));
  parts.push(code);
  parts.push(new Uint8Array(Int32Array.from(input.order).buffer));
  parts.push(new Uint8Array(Int32Array.from(input.family).buffer));

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function decodeSnapshot(buffer: ArrayBuffer): DecodedSnapshot {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (view.getUint32(0) !== SNAPSHOT_MAGIC) throw new Error("not a graph snapshot");
  const format = view.getUint32(4);
  if (format !== SNAPSHOT_FORMAT) {
    throw new Error(`snapshot format ${format}, expected ${SNAPSHOT_FORMAT}`);
  }
  const headerLen = view.getUint32(8);
  const labelLen = view.getUint32(12);

  let at = 16;
  const decoder = new TextDecoder();
  const header = JSON.parse(decoder.decode(bytes.subarray(at, at + headerLen)));
  at += headerLen;
  const labels = decoder.decode(bytes.subarray(at, at + labelLen)).split("\n");
  at += labelLen;

  const { n, m, srcBytes, tgtBytes, communities } = header as {
    n: number;
    m: number;
    srcBytes: number;
    tgtBytes: number;
    communities: number;
  };
  const take = (len: number) => {
    const slice = bytes.slice(at, at + len);
    at += len;
    return slice;
  };

  const type = take(n);
  const organRaw = take(n);
  const chapterRaw = take(n);
  const community = new Uint16Array(take(n * 2).buffer);
  const offsetsRaw = new Int8Array(take(n * 3).buffer);
  const srcRaw = take(srcBytes);
  const tgtRaw = take(tgtBytes);
  const packedCode = take(m);
  const edgeCode = new Uint8Array(m);
  const edgeFlipped = new Uint8Array(m);
  for (let i = 0; i < m; i++) {
    edgeCode[i] = packedCode[i] & ~FLIPPED;
    edgeFlipped[i] = packedCode[i] & FLIPPED ? 1 : 0;
  }
  const orderArr = new Int32Array(take(communities * 4).buffer);
  const familyArr = new Int32Array(take(communities * 4).buffer);

  const organ = Int16Array.from(organRaw, (v) => v - 1);
  const chapter = Int16Array.from(chapterRaw, (v) => v - 1);
  const offsets = Float32Array.from(offsetsRaw, (v) => v / OFFSET_QUANT);

  const edgeSource = new Int32Array(m);
  const edgeTarget = new Int32Array(m);
  let sp = 0;
  let tp = 0;
  let source = 0;
  let target = 0;
  const readVarint = (buf: Uint8Array, at: number): [number, number] => {
    let shift = 0;
    let value = 0;
    for (;;) {
      const byte = buf[at++];
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return [value, at];
      shift += 7;
    }
  };
  for (let i = 0; i < m; i++) {
    let delta: number;
    [delta, sp] = readVarint(srcRaw, sp);
    // A new source restarts the target run at the source itself, which is where
    // the encoder started it: the pair is normalised, so target >= source.
    if (delta !== 0) target = source + delta;
    source += delta;
    [delta, tp] = readVarint(tgtRaw, tp);
    target += delta;
    edgeSource[i] = source;
    edgeTarget[i] = target;
  }

  return {
    built: header.built,
    organs: header.organs,
    chapters: header.chapters,
    labels,
    type,
    organ,
    chapter,
    community,
    offsets,
    edgeSource,
    edgeTarget,
    edgeCode,
    edgeFlipped,
    order: orderArr,
    family: familyArr,
  };
}
