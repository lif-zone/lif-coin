#!/usr/bin/env node
'use strict';
const SHA256 = require('../lib/utils/sha256');
const chunks = [];
process.stdin.on('data', chunk=>chunks.push(chunk));
process.stdin.on('end', ()=>{
  const buf = Buffer.concat(chunks);
  const hash = SHA256.digest(buf);
  process.stdout.write(hash.toString('hex')+'\n');
});
