#!/usr/bin/env node
'use strict';
process.title = 'lif_node';
import '../browser/browser_env.js';
import {mine_single, target_to_compact, target_from_nhash,
  mine, header_set_time} from '../browser/mine.js';

console.log('start');
let target = target_to_compact(target_from_nhash(500));
let header = Buffer.alloc(80);
header[0] = 19;
let a = [];
for (let i=0; i<100; i++){
  header_set_time(header, i);
  let ret = mine({pow: 'sha256lif', header, min: 0, max: 5000, target});
  a.push(ret.nonce);
}
a = a.sort((a,b)=>a-b);
let sum = a.reduce((a,b)=>a+b, 0);
console.log(a);
console.log('end', Math.round(sum/a.length));

