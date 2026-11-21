/*!
 * taggedhash.js - BIP 340 tagged hashes for bcoin
 * https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
 */

'use strict';

const sha256 = require('bcrypto/lib/sha256');

const tagCache = Object.create(null);

function getTagPrefix(tag) {
  if (tagCache[tag])
    return tagCache[tag];
  const h = sha256.digest(Buffer.from(tag));
  const prefix = Buffer.concat([h, h]);
  tagCache[tag] = prefix;
  return prefix;
}

function taggedHash(tag, ...data) {
  const prefix = getTagPrefix(tag);
  const ctx = sha256.ctx;
  ctx.init();
  ctx.update(prefix);
  for (const buf of data)
    ctx.update(buf);
  return ctx.final();
}

taggedHash.TapSighash = (...data)=>taggedHash('TapSighash', ...data);
taggedHash.TapLeaf = (...data)=>taggedHash('TapLeaf', ...data);
taggedHash.TapBranch = (...data)=>taggedHash('TapBranch', ...data);
taggedHash.TapTweak = (...data)=>taggedHash('TapTweak', ...data);

module.exports = taggedHash;
