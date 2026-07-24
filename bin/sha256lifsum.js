#!/usr/bin/env node
'use strict';
const SHA256 = require('../lib/utils/sha256');
const SHA256LIF = require('../lib/utils/sha256lif');
const arg = process.argv.find(a=>a=='sha256'||a=='sha256lif'||a=='hash256'||a=='hash256lif') || 'sha256lif';
const hex = process.argv.includes('hex');
const chunks = [];
process.stdin.on('data', chunk=>chunks.push(chunk));
process.stdin.on('end', ()=>{
  let buf = Buffer.concat(chunks);
  if (hex)
    buf = Buffer.from(buf.toString('ascii'), 'hex');
  let hash;
  if (arg=='sha256')
    hash = SHA256.digest(buf);
  else if (arg=='sha256lif')
    hash = SHA256LIF.digest(buf);
  else if (arg=='hash256')
    hash = SHA256.digest(SHA256.digest(buf));
  else if (arg=='hash256lif')
    hash = SHA256LIF.digest(SHA256.digest(buf));
  else {
    console.log('inknown sha');
    process.exit(1);
  }
  process.stdout.write(hash.toString('hex')+'\n');
});
