#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const bdb = require('bdb');
const bio = require('bufio');

const network = 'lifmain';
const prefix = path.join(require('os').homedir(), 'lif.store', 'lifmain');
const magic_old = 0x7e;
const magic_now = 0x4b7c6b7e;

if (magic_old===magic_now)
  throw new Error('magic_old and magic_now are the same');

function magic_buf(magic){
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(magic);
  return buf;
}

const magic_old_buf = magic_buf(magic_old);
const magic_now_buf = magic_buf(magic_now);

// Patch 4 bytes of magic in a LevelDB at key 'O'
async function patch_leveldb(location, label){
  console.log(`Patching ${label}: ${location}`);
  const db = bdb.create({location, memory: false});
  await db.open();
  const key = Buffer.from([0x4f]); // 'O'
  const raw = await db.get(key);
  if (!raw){
    console.log(`  No key O found in ${label}, skipping`);
    await db.close();
    return;
  }
  const cur = raw.readUInt32LE(0);
  if (cur===magic_now){
    console.log(`  ${label} already has new magic, skipping`);
    await db.close();
    return;
  }
  if (cur!==magic_old){
    console.log(`  ${label} magic 0x${cur.toString(16)} does not match`
      + ` old 0x${magic_old.toString(16)}, skipping`);
    await db.close();
    return;
  }
  raw.writeUInt32LE(magic_now, 0);
  await db.put(key, raw);
  console.log(`  ${label} patched`);
  await db.close();
}

// Walk block flat files frame-by-frame, only replacing magic at frame boundaries
async function patch_block_files(blocks_dir){
  console.log(`Patching block files: ${blocks_dir}`);
  const files = fs.readdirSync(blocks_dir)
    .filter(f=>/^(blk|blu|blf|blm)\d{5}\.dat$/.test(f))
    .sort();
  let total = 0;
  for (const file of files){
    const filepath = path.join(blocks_dir, file);
    const data = fs.readFileSync(filepath);
    const is_hash = /^(blu|blf)/.test(file);
    let count = 0;
    let pos = 0;
    while (pos+8 <= data.length){
      const magic = data.readUInt32LE(pos);
      if (magic!==magic_old){
        // scan forward 1 byte like _index() does
        pos++;
        continue;
      }
      const length = data.readUInt32LE(pos+4);
      // header size: magic(4) + length(4) + optional hash(32)
      const hdr = is_hash ? 40 : 8;
      if (pos+hdr+length > data.length){
        console.log(`  ${file}: bad frame at offset ${pos}, stopping`);
        break;
      }
      magic_now_buf.copy(data, pos);
      count++;
      pos += hdr+length;
    }
    if (count>0){
      fs.writeFileSync(filepath, data);
      console.log(`  ${file}: ${count} replacements`);
      total += count;
    }
  }
  console.log(`  Block files: ${total} total replacements`);
}

async function main(){
  console.log(`Network: ${network}`);
  console.log(`Prefix: ${prefix}`);
  console.log(`Magic: 0x${magic_old.toString(16)} -> 0x${magic_now.toString(16)}`);
  console.log('');

  // 1. ChainDB LevelDB
  await patch_leveldb(path.join(prefix, 'chain'), 'chain');

  // 2. Indexer LevelDBs
  const index_dir = path.join(prefix, 'index');
  if (fs.existsSync(index_dir)){
    const indexers = ['tx', 'addr', 'filter/BASIC', 'lif_kv'];
    for (const name of indexers){
      const loc = path.join(index_dir, name);
      if (fs.existsSync(loc))
        await patch_leveldb(loc, 'indexer/'+name);
    }
  }

  // 3. Block store index LevelDB
  const blocks_index = path.join(prefix, 'blocks', 'index');
  if (fs.existsSync(blocks_index))
    await patch_leveldb(blocks_index, 'blocks/index');

  // 4. Block flat files
  const blocks_dir = path.join(prefix, 'blocks');
  if (fs.existsSync(blocks_dir))
    await patch_block_files(blocks_dir);

  console.log('\nDone.');
}

main().catch(e=>{
  console.error(e);
  process.exit(1);
});
