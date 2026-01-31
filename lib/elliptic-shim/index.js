"use strict";

/**
 * Elliptic Compatibility Shim
 *
 * Wraps @noble/curves (secure, audited) with elliptic's API
 * to fix CVE-2024-48949 and CVE-2024-21483 vulnerabilities
 * while maintaining compatibility with Solana SDK and other dependencies.
 */

const { secp256k1 } = require("@noble/curves/secp256k1");
const { p256 } = require("@noble/curves/p256");
const { ed25519 } = require("@noble/curves/ed25519");

// Map curve names to @noble/curves implementations
const curves = {
  secp256k1: secp256k1,
  p256: p256,
  prime256v1: p256, // alias
  ed25519: ed25519,
};

/**
 * BN (Big Number) compatibility class
 * Wraps BigInt with elliptic's BN-like interface
 */
class BN {
  constructor(value, base) {
    if (typeof value === "bigint") {
      this._value = value;
    } else if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      this._value = BigInt("0x" + Buffer.from(value).toString("hex"));
    } else if (typeof value === "string") {
      if (base === 16 || base === "hex") {
        this._value = BigInt("0x" + value);
      } else {
        this._value = BigInt(value);
      }
    } else if (typeof value === "number") {
      this._value = BigInt(value);
    } else {
      this._value = BigInt(0);
    }
  }

  toArray(endian, length) {
    let hex = this._value.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    if (length) {
      while (bytes.length < length) {
        bytes.unshift(0);
      }
    }
    if (endian === "le") {
      bytes.reverse();
    }
    return bytes;
  }

  toArrayLike(ArrayType, endian, length) {
    const arr = this.toArray(endian, length);
    if (ArrayType === Buffer) {
      return Buffer.from(arr);
    }
    return new ArrayType(arr);
  }

  toString(base) {
    if (base === 16 || base === "hex") {
      return this._value.toString(16);
    }
    return this._value.toString();
  }

  toNumber() {
    return Number(this._value);
  }
}

/**
 * KeyPair compatibility class
 */
class KeyPair {
  constructor(curve, options) {
    this._curve = curve;
    this._priv = null;
    this._pub = null;

    if (options.priv) {
      this._priv = this._normalizePrivateKey(options.priv);
      this._pub = curve.getPublicKey(this._priv);
    } else if (options.pub) {
      this._pub = this._normalizePublicKey(options.pub);
    }
  }

  _normalizePrivateKey(key) {
    if (key instanceof Uint8Array || Buffer.isBuffer(key)) {
      return new Uint8Array(key);
    }
    if (typeof key === "string") {
      return hexToBytes(key);
    }
    if (key instanceof BN) {
      return hexToBytes(key.toString(16).padStart(64, "0"));
    }
    return key;
  }

  _normalizePublicKey(key) {
    if (key instanceof Uint8Array || Buffer.isBuffer(key)) {
      return new Uint8Array(key);
    }
    if (typeof key === "string") {
      return hexToBytes(key);
    }
    // Handle point objects
    if (key.x && key.y) {
      const x = typeof key.x === "string" ? key.x : key.x.toString(16);
      const y = typeof key.y === "string" ? key.y : key.y.toString(16);
      return hexToBytes("04" + x.padStart(64, "0") + y.padStart(64, "0"));
    }
    return key;
  }

  getPrivate(enc) {
    if (!this._priv) return null;
    if (enc === "hex") {
      return bytesToHex(this._priv);
    }
    return new BN(this._priv);
  }

  getPublic(compact, enc) {
    if (typeof compact === "string") {
      enc = compact;
      compact = false;
    }

    let pub = this._pub;
    if (compact) {
      // Return compressed public key
      const point = this._curve.ProjectivePoint.fromHex(pub);
      pub = point.toRawBytes(true);
    }

    if (enc === "hex") {
      return bytesToHex(pub);
    }
    if (enc === "array") {
      return Array.from(pub);
    }

    // Return a point-like object
    return new Point(this._curve, pub);
  }

  sign(msg, enc, options) {
    const msgBytes = typeof msg === "string" ? hexToBytes(msg) : msg;
    const sig = this._curve.sign(msgBytes, this._priv);
    return new Signature(sig, this._curve);
  }

  verify(msg, sig) {
    const msgBytes = typeof msg === "string" ? hexToBytes(msg) : msg;
    let sigBytes;

    if (sig instanceof Signature) {
      sigBytes = sig.toDER();
    } else if (typeof sig === "string") {
      sigBytes = hexToBytes(sig);
    } else {
      sigBytes = sig;
    }

    try {
      return this._curve.verify(sigBytes, msgBytes, this._pub);
    } catch {
      return false;
    }
  }
}

/**
 * Point compatibility class
 */
class Point {
  constructor(curve, bytes) {
    this._curve = curve;
    this._point = curve.ProjectivePoint.fromHex(bytes);
  }

  getX() {
    return new BN(this._point.x);
  }

  getY() {
    return new BN(this._point.y);
  }

  encode(enc, compact) {
    const bytes = this._point.toRawBytes(compact);
    if (enc === "hex") {
      return bytesToHex(bytes);
    }
    if (enc === "array") {
      return Array.from(bytes);
    }
    return bytes;
  }

  mul(k) {
    const scalar = k instanceof BN ? k._value : BigInt(k);
    const newPoint = this._point.multiply(scalar);
    const bytes = newPoint.toRawBytes(false);
    return new Point(this._curve, bytes);
  }

  add(other) {
    const newPoint = this._point.add(other._point);
    const bytes = newPoint.toRawBytes(false);
    return new Point(this._curve, bytes);
  }
}

/**
 * Signature compatibility class
 */
class Signature {
  constructor(sig, curve) {
    this._sig = sig;
    this._curve = curve;
  }

  get r() {
    return new BN(this._sig.r);
  }

  get s() {
    return new BN(this._sig.s);
  }

  get recoveryParam() {
    return this._sig.recovery || 0;
  }

  toDER(enc) {
    const der = this._sig.toDERRawBytes();
    if (enc === "hex") {
      return bytesToHex(der);
    }
    return Array.from(der);
  }

  toCompact(enc) {
    const compact = this._sig.toCompactRawBytes();
    if (enc === "hex") {
      return bytesToHex(compact);
    }
    return Array.from(compact);
  }
}

/**
 * EC (Elliptic Curve) compatibility class
 * Main entry point matching elliptic's API
 */
class EC {
  constructor(curveName) {
    this._curve = curves[curveName];
    if (!this._curve) {
      throw new Error(`Curve ${curveName} not supported`);
    }
    this._curveName = curveName;
  }

  keyFromPrivate(priv, enc) {
    let privBytes;
    if (typeof priv === "string") {
      privBytes = hexToBytes(priv);
    } else if (Buffer.isBuffer(priv) || priv instanceof Uint8Array) {
      privBytes = new Uint8Array(priv);
    } else if (priv instanceof BN) {
      privBytes = hexToBytes(priv.toString(16).padStart(64, "0"));
    } else {
      privBytes = priv;
    }
    return new KeyPair(this._curve, { priv: privBytes });
  }

  keyFromPublic(pub, enc) {
    let pubBytes;
    if (typeof pub === "string") {
      pubBytes = hexToBytes(pub);
    } else if (Buffer.isBuffer(pub) || pub instanceof Uint8Array) {
      pubBytes = new Uint8Array(pub);
    } else if (pub.x && pub.y) {
      // Handle point object with x, y coordinates
      const x = typeof pub.x === "string" ? pub.x : pub.x.toString(16);
      const y = typeof pub.y === "string" ? pub.y : pub.y.toString(16);
      pubBytes = hexToBytes("04" + x.padStart(64, "0") + y.padStart(64, "0"));
    } else {
      pubBytes = pub;
    }
    return new KeyPair(this._curve, { pub: pubBytes });
  }

  genKeyPair() {
    const priv = this._curve.utils.randomPrivateKey();
    return new KeyPair(this._curve, { priv });
  }

  sign(msg, key, enc, options) {
    const keyPair = key instanceof KeyPair ? key : this.keyFromPrivate(key);
    return keyPair.sign(msg, enc, options);
  }

  verify(msg, sig, key, enc) {
    const keyPair = key instanceof KeyPair ? key : this.keyFromPublic(key);
    return keyPair.verify(msg, sig);
  }

  get curve() {
    return {
      g: this._curve.ProjectivePoint.BASE,
      n: new BN(this._curve.CURVE.n),
    };
  }

  get g() {
    return new Point(this._curve, this._curve.ProjectivePoint.BASE.toRawBytes(false));
  }

  get n() {
    return new BN(this._curve.CURVE.n);
  }
}

// Utility functions
function hexToBytes(hex) {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Export with elliptic-compatible API
module.exports = {
  ec: EC,
  EC: EC,
  curves: {
    secp256k1: { curve: secp256k1 },
    p256: { curve: p256 },
    ed25519: { curve: ed25519 },
  },
  // Also export utils that some packages might use
  utils: {
    BN: BN,
    toArray: (num, endian, length) => new BN(num).toArray(endian, length),
  },
};
