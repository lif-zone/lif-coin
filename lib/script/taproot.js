/*!
 * taproot.js - taproot utilities for bcoin
 * BIP 340/341/342
 */

'use strict';

const schnorr = require('bcrypto/lib/schnorr');
const taggedHash = require('./taggedhash');

function computeTweakHash(pubkey, merkleRoot) {
  if (merkleRoot)
    return taggedHash.TapTweak(pubkey, merkleRoot);
  return taggedHash.TapTweak(pubkey);
}

function tweakPublicKey(pubkey, merkleRoot) {
  const tweak = computeTweakHash(pubkey, merkleRoot);
  return schnorr.publicKeyTweakAdd(pubkey, tweak);
}

function tweakPrivateKey(privkey, merkleRoot) {
  const pubkey = schnorr.publicKeyCreate(privkey);
  const tweak = computeTweakHash(pubkey, merkleRoot);
  return schnorr.privateKeyTweakAdd(privkey, tweak);
}

function checkTweakPublicKey(outputKey, internalKey, merkleRoot) {
  const tweak = computeTweakHash(internalKey, merkleRoot);
  return schnorr.publicKeyTweakCheck(internalKey, tweak, outputKey, false)
    || schnorr.publicKeyTweakCheck(internalKey, tweak, outputKey, true);
}

function computeTapleafHash(leafVersion, script) {
  const buf = Buffer.isBuffer(script) ? script : script.toRaw();
  const prefix = Buffer.alloc(1, leafVersion);
  const len = Buffer.alloc(encodingSize(buf.length));
  writeVarint(len, buf.length, 0);
  return taggedHash.TapLeaf(prefix, len, buf);
}

function computeTapbranchHash(a, b) {
  if (Buffer.compare(a, b) > 0)
    return taggedHash.TapBranch(b, a);
  return taggedHash.TapBranch(a, b);
}

function computeMerkleRoot(controlBlock, leafHash) {
  const pathLen = (controlBlock.length - 33) / 32;
  let hash = leafHash;
  for (let i = 0; i < pathLen; i++) {
    const node = controlBlock.slice(33 + i * 32, 33 + (i + 1) * 32);
    hash = computeTapbranchHash(hash, node);
  }
  return hash;
}

function encodingSize(n) {
  if (n < 0xfd)
    return 1;
  if (n <= 0xffff)
    return 3;
  if (n <= 0xffffffff)
    return 5;
  return 9;
}

function writeVarint(buf, n, off) {
  if (n < 0xfd) {
    buf[off] = n;
  } else if (n <= 0xffff) {
    buf[off] = 0xfd;
    buf[off + 1] = n & 0xff;
    buf[off + 2] = (n >> 8) & 0xff;
  } else if (n <= 0xffffffff) {
    buf[off] = 0xfe;
    buf[off + 1] = n & 0xff;
    buf[off + 2] = (n >> 8) & 0xff;
    buf[off + 3] = (n >> 16) & 0xff;
    buf[off + 4] = (n >> 24) & 0xff;
  }
  return off + encodingSize(n);
}

exports.computeTweakHash = computeTweakHash;
exports.tweakPublicKey = tweakPublicKey;
exports.tweakPrivateKey = tweakPrivateKey;
exports.checkTweakPublicKey = checkTweakPublicKey;
exports.computeTapleafHash = computeTapleafHash;
exports.computeTapbranchHash = computeTapbranchHash;
exports.computeMerkleRoot = computeMerkleRoot;

// Constants
exports.TAPROOT_LEAF_MASK = 0xfe;
exports.TAPROOT_LEAF_TAPSCRIPT = 0xc0;
exports.TAPROOT_ANNEX_TAG = 0x50;
exports.WITNESS_V1_TAPROOT_SIZE = 32;
exports.TAPROOT_CONTROL_BASE_SIZE = 33;
exports.TAPROOT_CONTROL_NODE_SIZE = 32;
exports.TAPROOT_CONTROL_MAX_NODE_COUNT = 128;
