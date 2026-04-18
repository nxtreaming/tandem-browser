import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import {
  parseCrx3Header,
  deriveExtensionIdFromPublicKey,
  verifyCrx3Signature,
} from '../crx-verifier';

// ─── Protobuf wire-format encoder (test helper only) ──────────────────────

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  bytes.push(v & 0x7f);
  return Buffer.from(bytes);
}

function encodeTag(fieldNumber: number, wireType: number): Buffer {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeLengthDelimited(fieldNumber: number, payload: Buffer): Buffer {
  return Buffer.concat([encodeTag(fieldNumber, 2), encodeVarint(payload.length), payload]);
}

// AsymmetricKeyProof { 1: public_key, 2: signature }
function encodeKeyProof(publicKey: Buffer, signature: Buffer): Buffer {
  return Buffer.concat([
    encodeLengthDelimited(1, publicKey),
    encodeLengthDelimited(2, signature),
  ]);
}

// SignedData { 1: crx_id }
function encodeSignedData(crxId: Buffer): Buffer {
  return encodeLengthDelimited(1, crxId);
}

// ─── CRX3 builder (test helper) ──────────────────────────────────────────

interface BuildOpts {
  zipPayload: Buffer;
  crxId: Buffer;              // 16 bytes — derived from first public key
  privateKey: crypto.KeyObject;
  publicKeyDer: Buffer;       // SPKI DER encoding
}

const CRX3_MAGIC = Buffer.from('Cr24');
const CRX3_VERSION = 3;
const CRX3_SIGNED_DATA_PREFIX = Buffer.from('CRX3 SignedData\0', 'binary');

function signOver(privateKey: crypto.KeyObject, signedHeaderData: Buffer, zip: Buffer): Buffer {
  const signer = crypto.createSign('sha256');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(signedHeaderData.length, 0);
  signer.update(CRX3_SIGNED_DATA_PREFIX);
  signer.update(lenBuf);
  signer.update(signedHeaderData);
  signer.update(zip);
  return signer.sign(privateKey);
}

function buildCrx3(opts: BuildOpts): Buffer {
  const signedHeaderData = encodeSignedData(opts.crxId);
  const signature = signOver(opts.privateKey, signedHeaderData, opts.zipPayload);
  const rsaProof = encodeKeyProof(opts.publicKeyDer, signature);
  const header = Buffer.concat([
    encodeLengthDelimited(2, rsaProof),            // field 2: sha256_with_rsa[]
    encodeLengthDelimited(10000, signedHeaderData), // field 10000: signed_header_data
  ]);

  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(header.length, 0);
  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32LE(CRX3_VERSION, 0);

  return Buffer.concat([CRX3_MAGIC, versionBuf, lenBuf, header, opts.zipPayload]);
}

// ─── Fixtures (generated once per file) ──────────────────────────────────

let keyPair: crypto.KeyPairKeyObjectResult;
let publicKeyDer: Buffer;
let expectedExtensionId: string;
const zipPayload = Buffer.from('PK\x03\x04fake-zip-content-for-signing-test', 'binary');

beforeAll(() => {
  keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  publicKeyDer = keyPair.publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  // CRX extension ID: sha256 of SPKI public key, take first 16 bytes, map
  // each nibble (0-15) through the a-p alphabet.
  const digest = crypto.createHash('sha256').update(publicKeyDer).digest();
  const first16 = digest.subarray(0, 16);
  expectedExtensionId = Array.from(first16)
    .map((b) => {
      const hi = (b >> 4) & 0xf;
      const lo = b & 0xf;
      return String.fromCharCode(97 + hi) + String.fromCharCode(97 + lo);
    })
    .join('');
});

function crxIdBytesFor(extensionId: string): Buffer {
  // Reverse of the a-p mapping: each character's code - 97 is a nibble.
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    const hi = extensionId.charCodeAt(i * 2) - 97;
    const lo = extensionId.charCodeAt(i * 2 + 1) - 97;
    buf[i] = (hi << 4) | lo;
  }
  return buf;
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('deriveExtensionIdFromPublicKey()', () => {
  it('maps a SPKI DER public key to a 32-char a-p extension ID', () => {
    const id = deriveExtensionIdFromPublicKey(publicKeyDer);
    expect(id).toBe(expectedExtensionId);
    expect(id).toMatch(/^[a-p]{32}$/);
  });

  it('is stable for the same input', () => {
    const a = deriveExtensionIdFromPublicKey(publicKeyDer);
    const b = deriveExtensionIdFromPublicKey(publicKeyDer);
    expect(a).toBe(b);
  });

  it('differs for different public keys', () => {
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const otherDer = other.publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    expect(deriveExtensionIdFromPublicKey(publicKeyDer)).not.toBe(deriveExtensionIdFromPublicKey(otherDer));
  });
});

describe('parseCrx3Header()', () => {
  it('extracts RSA proofs and signed_header_data from a well-formed CRX3', () => {
    const crx = buildCrx3({
      zipPayload,
      crxId: crxIdBytesFor(expectedExtensionId),
      privateKey: keyPair.privateKey,
      publicKeyDer,
    });

    const { header, zipStart } = parseCrx3Header(crx);

    expect(header.rsaProofs).toHaveLength(1);
    expect(header.rsaProofs[0].publicKey.equals(publicKeyDer)).toBe(true);
    expect(header.signedHeaderData.length).toBeGreaterThan(0);
    expect(crx.subarray(zipStart).equals(zipPayload)).toBe(true);
  });

  it('throws on truncated buffer', () => {
    expect(() => parseCrx3Header(Buffer.alloc(8))).toThrow();
  });

  it('throws on wrong magic', () => {
    const buf = Buffer.alloc(100);
    Buffer.from('XXXX').copy(buf, 0);
    expect(() => parseCrx3Header(buf)).toThrow(/magic/i);
  });

  it('throws on non-3 version', () => {
    const buf = Buffer.alloc(100);
    CRX3_MAGIC.copy(buf, 0);
    buf.writeUInt32LE(2, 4); // CRX2
    buf.writeUInt32LE(0, 8);
    expect(() => parseCrx3Header(buf)).toThrow(/version/i);
  });
});

describe('verifyCrx3Signature()', () => {
  it('returns valid=true for a correctly-signed CRX that matches the expected ID', () => {
    const crx = buildCrx3({
      zipPayload,
      crxId: crxIdBytesFor(expectedExtensionId),
      privateKey: keyPair.privateKey,
      publicKeyDer,
    });

    const result = verifyCrx3Signature(crx, expectedExtensionId);
    expect(result).toEqual({ valid: true });
  });

  it('returns valid=false if the zip payload is tampered after signing', () => {
    const crx = buildCrx3({
      zipPayload,
      crxId: crxIdBytesFor(expectedExtensionId),
      privateKey: keyPair.privateKey,
      publicKeyDer,
    });
    // Flip one byte deep in the zip region (past the header)
    const tampered = Buffer.from(crx);
    tampered[tampered.length - 5] ^= 0xff;

    const result = verifyCrx3Signature(tampered, expectedExtensionId);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/signature/i);
  });

  it('returns valid=false if the signature bytes are tampered', () => {
    const crx = buildCrx3({
      zipPayload,
      crxId: crxIdBytesFor(expectedExtensionId),
      privateKey: keyPair.privateKey,
      publicKeyDer,
    });
    // Flip a byte somewhere in the header (where the signature lives)
    const tampered = Buffer.from(crx);
    tampered[200] ^= 0xff;

    const result = verifyCrx3Signature(tampered, expectedExtensionId);
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when expectedExtensionId does not match key-derived ID', () => {
    const crx = buildCrx3({
      zipPayload,
      crxId: crxIdBytesFor(expectedExtensionId),
      privateKey: keyPair.privateKey,
      publicKeyDer,
    });

    const wrongId = 'a'.repeat(32);
    const result = verifyCrx3Signature(crx, wrongId);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extension id/i);
  });

  it('returns valid=false when signed_header_data crx_id does not match expectedExtensionId', () => {
    // Key is correct, but SignedData claims a different crx_id. This catches
    // an attacker substituting the signed header to point at another extension.
    const wrongCrxId = Buffer.alloc(16, 0xaa);
    const crx = buildCrx3({
      zipPayload,
      crxId: wrongCrxId,
      privateKey: keyPair.privateKey,
      publicKeyDer,
    });

    const result = verifyCrx3Signature(crx, expectedExtensionId);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/crx_id|signed header/i);
  });

  it('returns valid=false when no RSA proof is present', () => {
    // Header with only signed_header_data, no sha256_with_rsa list.
    const signedHeaderData = encodeSignedData(crxIdBytesFor(expectedExtensionId));
    const header = encodeLengthDelimited(10000, signedHeaderData);
    const versionBuf = Buffer.alloc(4);
    versionBuf.writeUInt32LE(CRX3_VERSION, 0);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(header.length, 0);
    const crx = Buffer.concat([CRX3_MAGIC, versionBuf, lenBuf, header, zipPayload]);

    const result = verifyCrx3Signature(crx, expectedExtensionId);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no sha256_with_rsa|no rsa|no signature/i);
  });
});
