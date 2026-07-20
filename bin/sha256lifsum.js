#!/usr/bin/env node
'use strict';
const SHA256LIF = require('../lib/utils/sha256lif');
const chunks = [];
process.stdin.on('data', chunk=>chunks.push(chunk));
process.stdin.on('end', ()=>{
  const buf = Buffer.concat(chunks);
  const hash = SHA256LIF.digest(buf);
  process.stdout.write(hash.toString('hex')+'\n');
});
