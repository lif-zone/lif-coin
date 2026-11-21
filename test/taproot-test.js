'use strict';

const assert = require('bsert');
const bio = require('bufio');
const Script = require('../lib/script/script');
const Witness = require('../lib/script/witness');
const Output = require('../lib/primitives/output');
const TX = require('../lib/primitives/tx');
const schnorr = require('bcrypto/lib/schnorr');
const taggedHash = require('../lib/script/taggedhash');
const taproot = require('../lib/script/taproot');

const scriptAssets = require('./data/core-data/script_assets_test.json');
const bip340Vectors = require('./data/core-data/bip340_vectors.json');
const bip341Vectors = require('./data/core-data/bip341_wallet_vectors.json');

function getFlags(flagStr) {
  let flags = 0;
  if (!flagStr || flagStr=='NONE')
    return flags;
  for (const name of flagStr.split(',')) {
    const flag = Script.flags[`VERIFY_${name.trim()}`];
    if (flag==null)
      throw new Error(`Unknown flag: ${name}`);
    flags |= flag;
  }
  return flags;
}

function parsePrevouts(hexArr) {
  const prevouts = [];
  for (const hex of hexArr) {
    const br = bio.read(Buffer.from(hex, 'hex'));
    const value = br.readI64();
    const script = Script.fromRaw(br.readVarBytes());
    prevouts.push({value, script});
  }
  return prevouts;
}

describe('Taproot', function() {
  // BIP 340 Schnorr Signatures
  describe('BIP 340 Schnorr', function() {
    for (const vec of bip340Vectors) {
      it(`vector ${vec.index}: ${vec.comment || 'verify'}`, function() {
        const pubkey = Buffer.from(vec.public_key, 'hex');
        const msg = Buffer.from(vec.message, 'hex');
        const sig = Buffer.from(vec.signature, 'hex');

        if (vec.secret_key) {
          const privkey = Buffer.from(vec.secret_key, 'hex');
          const aux = Buffer.from(vec.aux_rand, 'hex');
          const created = schnorr.sign(msg, privkey, aux);
          assert.bufferEqual(created, sig);
        }

        const result = schnorr.verify(msg, sig, pubkey);
        assert.strictEqual(result, vec.verification_result);
      });
    }
  });

  // BIP 341 Wallet Vectors (key tweaking, taproot commitments)
  describe('BIP 341 Wallet Vectors', function() {
    for (let i = 0; i < bip341Vectors.scriptPubKey.length; i++) {
      const vec = bip341Vectors.scriptPubKey[i];
      it(`scriptPubKey vector ${i}`, function() {
        const internalKey = Buffer.from(vec.given.internalPubkey, 'hex');
        const merkleRoot = vec.intermediary.merkleRoot
          ? Buffer.from(vec.intermediary.merkleRoot, 'hex')
          : null;

        // Check tweak
        const tweak = taproot.computeTweakHash(internalKey, merkleRoot);
        assert.strictEqual(tweak.toString('hex'),
          vec.intermediary.tweak);

        // Check tweaked pubkey
        const tweakedKey = taproot.tweakPublicKey(internalKey, merkleRoot);
        assert.strictEqual(tweakedKey.toString('hex'),
          vec.intermediary.tweakedPubkey);

        // Check scriptPubKey
        const spk = Buffer.from(vec.expected.scriptPubKey, 'hex');
        const script = Script.fromRaw(spk);
        assert(script.isTaproot());
        assert.bufferEqual(script.getTaproot(), tweakedKey);
      });
    }
  });

  // Tagged Hash
  describe('Tagged Hash', function() {
    it('should produce correct TapLeaf hash', function() {
      const leafVersion = 0xc0;
      const scriptHex = '20'
        + 'd85a959b0290bf19bb89ed43c916be835475d013da4b362117393e25a48229b8'
        + 'ac';
      const script = Buffer.from(scriptHex, 'hex');
      const hash = taproot.computeTapleafHash(leafVersion, script);
      assert.strictEqual(hash.toString('hex'),
        bip341Vectors.scriptPubKey[1].intermediary.leafHashes[0]);
    });

    it('should cache tag prefixes', function() {
      const h1 = taggedHash('TapTweak', Buffer.alloc(32));
      const h2 = taggedHash('TapTweak', Buffer.alloc(32));
      assert.bufferEqual(h1, h2);
    });
  });

  // Script Assets Test (Bitcoin Core taproot test vectors)
  describe('Script Assets (Bitcoin Core taproot vectors)', function() {
    this.timeout(120000);

    for (let i = 0; i < scriptAssets.length; i++) {
      const test = scriptAssets[i];
      it(`vector ${i}: ${test.comment}`, function() {
        const tx = TX.fromRaw(test.tx, 'hex');
        const prevouts = parsePrevouts(test.prevouts);
        const idx = test.index;
        const flags = getFlags(test.flags);

        // Set coin data on inputs for taproot sighash
        for (let j = 0; j < tx.inputs.length; j++) {
          tx.inputs[j].coin = prevouts[j];
        }

        if (test.success) {
          const scriptSig = test.success.scriptSig
            ? Script.fromRaw(test.success.scriptSig, 'hex')
            : new Script();
          const witness = new Witness(
            test.success.witness.map((w)=>Buffer.from(w, 'hex'))
          );
          const output = prevouts[idx].script;
          try {
            Script.verify(scriptSig, witness, output, tx, idx,
              prevouts[idx].value, flags, prevouts);
          } catch(e){
            assert.fail(`Success case should pass: ${e.message}`
              + ` (code: ${e.code})`);
          }
        }

        if (test.failure) {
          const scriptSig = test.failure.scriptSig
            ? Script.fromRaw(test.failure.scriptSig, 'hex')
            : new Script();
          const witness = new Witness(
            test.failure.witness.map((w)=>Buffer.from(w, 'hex'))
          );
          const output = prevouts[idx].script;
          let err;
          try {
            Script.verify(scriptSig, witness, output, tx, idx,
              prevouts[idx].value, flags, prevouts);
          } catch(e){
            err = e;
          }
          assert(err, 'Failure case should fail');
        }
      });
    }
  });
});
