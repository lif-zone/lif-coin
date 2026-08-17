#!/usr/bin/env node
'use strict';
process.title = 'gen';

import assert from 'bsert';
import consensus from '../lib/protocol/consensus.js';
import Networks from '../lib/protocol/networks.js';
import Network from '../lib/protocol/network.js';
import TX from '../lib/primitives/tx.js';
import MTX from '../lib/primitives/mtx.js';
import Block from '../lib/primitives/block.js';
import Script from '../lib/script/script.js';
import Mnemonic from '../lib/hd/mnemonic.js';
import HDPrivateKey from '../lib/hd/private.js';
import KeyRing from '../lib/primitives/keyring.js';
import Coin from '../lib/primitives/coin.js';
import Address from '../lib/primitives/address.js';
import {opcodes} from '../lib/script/common.js';
import {readFile, writeFile} from 'fs/promises';
import {homedir} from 'os';
import {spawn} from 'node:child_process';
import etask from 'lif-kernel/etask';
const {wait: ewait} = etask;
import {lifnet_connect} from 'lif-kernel/lifnet';

let cwd = import.meta.dirname;

async function system(command){
  let wait = ewait();
  const child = spawn(command, {
    shell: true, // so you can write "ls -la | grep foo"
    stdio: 'inherit' // output goes straight to your terminal
  });
  child.on('close', code=>wait.return(code)); // 0 = success
  child.on('error', wait.return(-1));
  return await wait;
}

async function sys_get(args){
  let wait = ewait();
  const child = spawn(args, [], {shell: true}); // shell: true ≈ system()
  let allout = '';
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', d=>{ stdout+=d; allout+=d; });
  child.stderr.on('data', d=>{ stderr+=d; allout+=d; });
  child.on('close', code=>wait.return({code, allout, stdout, stderr}));
  return await wait;
}
function buf_from_hex(b){
  if (Buffer.isBuffer(b))
    return Buffer.from(b);
  return Buffer.from(b, 'hex');
}
function buf_to_hex(b){
  b = Buffer.from(b);
  return b.toString('hex');
}
function int_to_hex(i){
  return '0x'+i.toString(16);
}

function lif_kv_script({net, key, val, valbin}){
  let s = new Script()
    .pushOp(opcodes.OP_RETURN)
    .pushData(Buffer.from(net || 'lif'))
    .pushData(Buffer.from('key'))
    .pushData(Buffer.from(key))
    .pushData(Buffer.from('val'))
    .pushData(Buffer.from(val));
  if (valbin)
    s = s.pushData(Buffer.from('valbin')).pushData(Buffer.from(valbin));
  return s.compile();
}

function createGenesisBlock(opt) {
  let flags = opt.flags;
  let key = opt.key;
  let reward = opt.reward;
  let is_lif = opt.net_type.startsWith('lif');
  if (is_lif && !flags) // The Torah HTURH
    //flags = 'The Guide 18/Oct/1984 Ancient philology open D.N.A eternal words book';
    // Mine your name
    //flags = 'The Guide 18/Oct/1984 Permissionless read-write bible torah guide BBS';
    //flags = ' M.S. Ancient Philology: Justice Ethics Morals letter word count guide';
    //flags = 'The Guide 18/Oct/1984 DNA Ancient philology book - eternal publishing';
    flags = 'The Guide KI TXA 08/ALU/5786 Ethernal MB Words Philology DNA/Shoshani';
    //flags = 'The Guide 21/TSR/5787 SMhT TURA Ethernal Words Philology DNA/Shoshani';
    //flags = 'The Happiness Guide 21/TSR/5787 Ethernal Words Philology DNA/Shoshani';
  // MR SUSNI. 1 2*5 6*10 18 7
  // The Counter HSUPR
  // How many sentences? how many words? how many letters?
  // with JPG: Ben Shoshan on Counter Helpers work
  if (!flags)
    flags = 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks';
  if (typeof flags=='string')
    flags = Buffer.from(flags, 'ascii');
  if (!key) {
    key = buf_from_hex(''
      +'04678afdb0fe5548271967f1a67130b7105cd6a828e039'
      +'09a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c3'
      +'84df7ba0b8d578a4c702b6bf11d5f');
  }
  if (!reward)
    reward = 50 * consensus.COIN;
  let input = new Script()
  .pushInt(0x1d00ffff) // ~4G hashing attempts needed
  // 1st genesis 2009: 4, 2nd genesis 2026 2.
  .pushPush(Buffer.from([is_lif ? 2 : 4]))
  .pushData(flags);
  let outputs = [{
    value: reward,
    script: Script.fromPubkey(key)
  }];
  let inputs = [{
    prevout: {hash: consensus.ZERO_HASH, index: 0xffffffff},
    script: input.compile(),
    sequence: 0xffffffff,
  }];
  if (is_lif && opt.btc_timestamp){
    let push_output = true;
    if (push_output){
      // push in output script
      let timestamp = {btc_timestamp: opt.btc_timestamp};
      let script = lif_kv_script({key: 'timestamp',
        val: JSON.stringify(timestamp)});
      outputs.push({value: 0, script});
    } else {
      // push in input script
      input.pushData('btc_timestamp');
      let btc_timestamp = buf_from_hex(opt.btc_timestamp).reverse();
      assert(btc_timestamp.length==32, 'invalid btc_timestamp');
      input.pushData(btc_timestamp);
    }
  }
  const tx = new TX({version: 1, inputs, outputs, locktime: 0});
  const merkleRoot = tx.hash();
  const block = new Block({
    version: opt.version,
    prevBlock: consensus.ZERO_HASH,
    merkleRoot,
    time: opt.time,
    bits: opt.bits,
    nonce: opt.nonce,
    height: 0,
  });
  block.txs.push(tx);
  return block;
}

function gen_block(name, opt={}){
  let net = Networks[name];
  let gen = net.genesis;
  return createGenesisBlock(
    {version: 1, time: gen.time, bits: gen.bits, nonce: gen.nonce,
    net_type: name, btc_timestamp: opt.btc_timestamp});
}

function str_diff(a, b){
  let i;
  for (i=0; i<a.length; i++){
    if (a[i]!=b[i])
      break;
  }
  if (i==a.length && i==b.length)
    return -1;
  console.log('pos '+i+' diff: '+a.slice(i, i+8)+' -> '+b.slice(i, i+8));
  return i;
}

function magic_from_hash(hash){
  return +('0x'+hash.slice(4, 6)+hash.slice(2, 4) +hash.slice(0, 2)+'7e');
}

// fixing sequence of lib/protocol/networks.js
// helps edit and validate lib/protocol/networks.js
function hex_lines(hex){ return "'"+hex.match(/.{1,70}/g).join("'\n+'")+"'"; }
function date_time(){ return Math.floor(Date.now()/1000); }
async function diff_block(name){
  let net = Networks[name];
  let g = net.genesis;
  let block = gen_block(name);
  let err, is_lif = name.startsWith('lif');
  console.log('--------- '+name+' ---------------');
  // complete block
  let b_orig = net.genesisBlock;
  let b_calc = block.toRaw().toString('hex');
  let D = 0;
  let genesisBlock_diff;
  if (b_orig!=b_calc){
    console.log(err='ERR genesisBlock calc:\n', hex_lines(b_calc));
    str_diff(b_orig, b_calc);
    genesisBlock_diff = true;
  }
  console.log('genesisBlock orig:\n', hex_lines(b_orig));
  // check merkleRoot
  let merkleRoot_calc = block.merkleRoot.toString('hex');
  let merkleRoot_orig = g.merkleRoot.toString('hex');
  if (merkleRoot_calc!=merkleRoot_orig){
    console.log(err='ERR set new: genesis.merkleRoot calc', merkleRoot_calc);
    console.log('orig merkleRoot', merkleRoot_orig);
  }
  // check orig header hash matchs computed
  let pow = net.pow;
  let h_orig = g.hash.toString('hex');
  let h_orig_comp = new Block().fromHead(buf_from_hex(b_orig)).hash()
    .toString('hex');
  if (h_orig!=h_orig_comp && !genesisBlock_diff)
    console.log(err='ERR genesisBlock orig calc hash:', h_orig_comp);
  if (g.nonce && !g.time)
    console.log(err='ERR genesis.nonce set but genesis.time=0');
  let h_calc;
  if (g.nonce)
    h_calc = block.hash().toString('hex');
  else
    h_calc = '01'.repeat(32); // mark hash not yet calculated
  if (h_calc!=h_orig)
    console.log(err='ERR genesis.hash calc:', h_calc);
  if (g.nonce){
    // check hash matches target
    let header = block.toRaw().slice(0, 80);
    let nonce = block.nonce;
    let mine_err;
    if (mine_range({header, min: nonce, max: nonce})<0){
      console.log(err='ERR target not reached:', int_to_hex(block.bits),
        common.getTarget(block.bits));
      mine_err = true;
    }
  }
  console.log('genesis.hash orig:', h_orig);
  if (g.bits!=pow.bits){
    console.log(err='ERR bits mismatch: g.bits '+int_to_hex(g.bits)+
      ' pow.bits '+int_to_hex(pow.bits));
  }
  let calc_bits = consensus.toCompact(pow.limit);
  if (calc_bits!=pow.bits){
    console.log(err='ERR limit mismatch: pow.bit '+int_to_hex(pow.bits)
      +' compact(limit) '+int_to_hex(calc_bits));
  }
  if (is_lif && D){
    // chainwork for genesis = 2^256 / (target + 1)
    let genesis_target = consensus.fromCompact(block.bits);
    let MAX_CHAINWORK = new BN(1).ushln(256);
    let genesis_chainwork = MAX_CHAINWORK.div(genesis_target.iaddn(1));
    let genesis_chainwork_hex = genesis_chainwork.toString('hex', 64);
    console.log('genesis chainwork:', genesis_chainwork_hex);
    let chainwork_hex = pow.chainwork.toString('hex', 64);
    if (pow.chainwork.gt(genesis_chainwork))
      console.log(err='ERR chainwork: pow.chainwork > genesis (genesis block fails minimum):', chainwork_hex);
  }
  if (is_lif){
    let magic_calc = magic_from_hash(h_orig);
    if (magic_calc != net.magic){
      console.log(err='ERR magic mismatch: orig '+int_to_hex(net.magic)+
        ' calc '+int_to_hex(magic_calc));
    }
  }
  if (err)
    console.log('ERROR');
  else
    console.log('SUCCESS');
  if (!g.nonce)
    await do_mine(block);
  return err;
}

import BN from 'bcrypto/lib/bn.js';
import hash256 from 'bcrypto/lib/hash256.js';
import sha256 from 'bcrypto/lib/sha256.js';
import _sha256 from '../lib/utils/sha256.js';
import sha256lif from '../lib/utils/sha256lif.js';
import hash256lif from '../lib/utils/hash256lif.js';
import mine from '../lib/mining/mine.js';
import  common from '../lib/mining/common.js';
const final = 1;

function mine_single({header, target, nonce, time}){
  let hash;
  header.writeUInt32LE(nonce, 76);
  header.writeUInt32LE(time, 68);
  //hash = sha256.digest(sha256.digest(header)); // 0.22M/sec
  //hash = _sha256.digest(_sha256.digest(header)); // 0.33M/sec
  //hash = sha256lif.digest(_sha256.digest(header)); // 0.29M/sec
  //hash = hash256lif.digest(header); // 0.29M/sec
  //hash = hash256.digest(header); // 0.36M/sec
  const net = Network.get();
  hash = net.pow_hash256.digest(header);
  let found = mine.rcmp(hash, target)<=0;
  if (!found)
    return;
  console.log('found nonce', nonce, 'time', time, 'header:\n', hex_lines(header.toString('hex')));
  return true;
}

function mine_range({header, target, min, max, time}){
  if (!target)
    target = common.getTarget(header.readUInt32LE(72));
  if (!time)
    time = header.readUInt32LE(68) || date_time();
  if (0)
    return mine(header, target, min, max); // 0.28M/sec
  for (let nonce=min; nonce<=max; nonce++){
    if (mine_single({header, target, nonce, time}))
      return nonce;
  }
  return -1;
}

function mine_slave({header, min, max, target}){ return etask(function*(){
  // copied as-is from lif-wallet/mine_pool.js. not yet tested here
  const net = Network.get();
  let pow = net.pow_hash256_name;
  let {sock, error} = yield lifnet_connect('lifcoin/mine_slave',
    {header: buf_to_hex(header), target, min, max, pow});
  if (error)
    return {found: false, error};
  let done = ewait();
  let res;
  sock.method('update', up=>this.emit('update', up));
  sock.method('found', ret=>{
    res = {...ret, header: buf_from_hex(ret.header)};
  });
  sock.method('not_found', ret=>{
    res = {found: false, ...ret};
  });
  sock.on('close', ()=>done.return(
    res || {found: false, error: 'disconnected'}));
  this.on('finally', ()=>sock.close());
  let ret = yield done;
  console.log('mine_slave return', ret);
  return ret;
}); }

let enable_slave = process.env.MINE_SLAVE;
function do_mine(block){ return etask(function*(){
  // $ speed -bytes 80 sha256
  // Doing sha256 for 3s on 80 size blocks: 4368155 sha256's in 2.98s
  // so does 1.3M/sec (nodeJS native).
  // For bitcoin block double hashing: 0.77M/sec.
  // to reach 4G - needs 5000 sec. Thats more than one hour
  // sha256.digest(header); --> 0.25M/sec (6 times slower than NodeJS native)
  console.log('-------------- mining... ---------------');
  let header = block.toRaw().slice(0, 80);
  let min = 0; // nonce bitcoin genesis 2083236893
  let max = 0x100000000;
  let bits = block.bits;
  //bits = 0x1f00ffff; // make it easier for testing
  let target = common.getTarget(bits);
  console.log('difficulty:', int_to_hex(bits), buf_to_hex(target));
  let inc = 200000;
  let nonce = -1;
  let fixed_time = header.readUInt32LE(68);
  let time = fixed_time, time_last;
  for (let i=min; i<=max; i+=inc){
    let start = Date.now();
    if (!fixed_time){
      time = date_time();
      if (time!=time_last)
        i = min;
      time_last = time;
    }
    let _max = Math.min(max, i+inc-1);
    if (enable_slave){
      let ret = yield mine_slave({header, target: bits, min: i, max: _max, time});
      if (ret?.error)
        return void console.log('mine_slave ERR', ret.error);
      if (ret.found){
        nonce = ret.nonce;
        time = ret.time;
      } else
        nonce = -1;
    } else
      nonce = mine_range({header, target, min: i, max: _max, time});
    if (nonce>=0)
      break;
    let tm = Date.now()-start;
    console.log(tm+'ms at '+i+' '+(inc/tm/1000)+'M/sec');
  }
  if (nonce<0){
    console.log('failed mining');
    return;
  }
  const net = Network.get();
  let hash = net.pow_hash256.digest(header).reverse().toString('hex');
  console.log('SUCCESS: nonce '+nonce, 'time '+time,
    'header ', header.toString('hex'), 'hash', hash);
  return {nonce, time, header, hash};
}); }

export async function do_test(){
  let error;
  await diff_block('main');
  Network.set('lifmain');
  error ||= await diff_block('lifmain');
  Network.set();
  0 && await diff_block('testnet');
  0 && await diff_block('liftest');
  0 && await diff_block('regtest');
  0 && await diff_block('simnet');
  0 && await do_mine(gen_block('main'));
  Network.set('lifmain');
  0 && await do_mine(gen_block('lifmain'));
  Network.set();
  return {error};
}

function bech32(mnemonic){
  const _mnemonic = Mnemonic.fromPhrase(mnemonic);
  const hdPrivKey = HDPrivateKey.fromMnemonic(_mnemonic);
  const derivedKey = hdPrivKey.derive(84, true)
  .derive(0, true).derive(0, true).derive(0).derive(0);
  const keyRing = new KeyRing({privateKey: derivedKey.privateKey,
    witness: true});
  const net = Network.get();
  const address = keyRing.getKeyAddress('string', net);
  return {
    privateKey: derivedKey.privateKey.toString('hex'),
    publicKey: keyRing.publicKey.toString('hex'),
    address: address,
    keyRing: keyRing
  };
}
let wallet1 = 'six clip senior spy fury aerobic volume sheriff critic number feature inside';
let wallet1_a = bech32(wallet1);
let wallet2 = 'morning like hello gym core stage wood deposit artefact monster turn absorb';
let wallet2_a = bech32(wallet1);

async function file_lines(file){
  let f;
  try {
    f = await readFile(file, 'utf8');
    return f.split('\n');
  } catch(error){
    console.error(error);
    console.log('failed file_lines '+file);
    return {error};
  }
}
async function file_write_lines(file, lines){
  let f;
  try {
    await writeFile(file, lines.join('\n'), 'utf-8');
  } catch(error){
    console.error(error);
    console.log('failed file_lines '+file);
    return {error};
  }
}
async function file_json(file){
  let f;
  try {
    f = await readFile(file, 'utf8');
    return JSON.parse(f);
  } catch(error){
    console.error(error);
    console.log('failed file_json '+file);
    return {error};
  }
}
async function fetch_json(url){
  try {
    0 && console.log('url', url);
    let ret = await fetch(url);
    let json = await ret.json();
    0 && console.log('res', json);
    return json;
  } catch(error){
    console.log('failed fetch '+url, error);
    return {error};
  }
}

async function btc_post_tx(tx){
  assert(typeof tx=='string' && tx.length>20);
  let url = 'https://mempool.space/api/tx';
  try {
    // https://btcscan.org/api/tx
    // https://blockstream.info/api/tx
    // https://blockchain.info/pushtx?cors=true
    let ret = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: tx,
    });
    let json = await ret.json();
    return json;
  } catch(error){
    console.log('failed fetch '+url);
    return {error};
  }
}

async function btc_fetch_tip(){
  // https://btcscan.org/api/blocks/tip
  // https://blockchain.info/latestblock
  // https://api.blockcypher.com/v1/btc/main
  let tip = await fetch_json('https://mempool.space/api/v1/blocks/tip');
  tip = tip?.[0];
  if (tip?.id?.length==64 && typeof tip?.height=='number')
    return tip;
  tip = await fetch_json('https://btcscan.org/api/blocks/tip');
  tip = tip?.[0];
  if (tip?.id?.length==64 && typeof tip?.height=='number')
    return tip;
  tip = await fetch_json('https://api.blockcypher.com/v1/btc/main');
  if (tip?.id?.length==64 && typeof tip?.height=='number')
    return tip;
  return {error: 'all fetch failed for tip'};
}
async function btc_get_tip(){
  let tip = await btc_fetch_tip();
  if (tip.error)
    return tip;
  if (!tip)
    return {error: 'invalid result of json tip'};
  if (typeof tip.height!='number' || tip<900000 || tip.height>1100000){
    console.log('invalid tip height', tip.height);
    return {error: 'invalid tip height'};
  }
  if (tip.id?.length!=64){
    console.log('invalid tip id', tip.id);
    return {error: 'invalid tip id'};
  }
  return tip;
}
async function btc_create_kv({coin, change_addr, fee, lif_kv, log=1}){
  let kv_val = JSON.stringify(lif_kv.val);
  let kv_script = lif_kv_script({key: 'timestamp', val: kv_val});
  let {keypair, value, vout, txid} = coin;
  let {priv, addr} = keypair;
  let keyRing = new KeyRing({privateKey: Buffer.from(priv, 'hex'),
    witness: true});
  let prevHash = Buffer.from(txid, 'hex').reverse();
  let c = Coin.fromOptions({
    hash: prevHash,
    index: vout,
    value,
    script: Script.fromAddress(addr),
  });
  let mtx = new MTX();
  mtx.addCoin(c);
  let change_script = Script.fromAddress(change_addr);
  mtx.addOutput({value: value - fee, script: change_script});
  mtx.changeIndex = 0;
  mtx.addOutput({value: 0, script: kv_script});
  let signed = mtx.sign(keyRing);
  if (!signed)
    return {error: 'keypair private key does not match coin address'};
  let tx = mtx.toTX();
  let hex = tx.toRaw().toString('hex');
  let _txid = tx.rhash();
  log>1 && console.log('BTC TX:', mtx.toJSON());
  log && console.log('BTC TX hex:', hex);
  log && console.log('BTC TXID:', _txid);
  return {tx, tx_hex: hex, txid: _txid};
}

async function update_networks_js({nonce, time, merkleRoot, magic, hash, genesisBlock}){
  let lines = await file_lines(cwd+'/../lib/protocol/networks.js');
  let _error;
  if (lines?.error)
    return lines;
  function set(token, replace){
    if (typeof replace=='string')
      replace = [replace];
    let found;
    for (let i=0; i<lines.length; i++){
      let l = lines[i];
      if (!l.includes(token))
        continue;
      found ??= i;
      lines = [...lines.slice(0, i), ...lines.slice(i+1)];
      i--;
    }
    if (!found)
      return _error = {error: 'networks.js token not found: '+token};
    lines = [...lines.slice(0, found), ...replace, ...lines.slice(found)];
  }
  set('SET_merkleRoot',
    `  merkleRoot: b('${merkleRoot}'), // SET_merkleRoot`);
  set('SET_magic',
    `lifmain.magic = 0x${magic.toString(16)}; // SET_magic`);
  set('SET_time',
    `  time: ${time}, // SET_time`);
  set('SET_nonce',
    `  nonce: ${nonce}, // SET_nonce`);
  set('SET_hash',
    `  hash: b('${hash}'), // SET_hash`);
  if (_error)
    return _error;
  let gb = hex_lines(genesisBlock)+';';
  gb = gb.split('\n');
  gb = gb.map(l=>'  '+l+' // SET_genesisBlock');
  set('SET_genesisBlock', gb);
  return await file_write_lines(cwd+'/../lib/protocol/networks.js', lines);
}

async function git_orig_networks_js(){
  return;
  let ret = await sys_get(`cd ${cwd}/.. && git diff lib/protocols/networks.js`);
  if (ret.str!==''|| ret.code)
    return {error: 'diff in lib/protocol/networks.js: '+ret};
}
async function git_commit_networks_js(hash){
  let ret = await sys_get(`cd ${cwd}/.. && git commit -m "mined genesis block ${hash}" lib/protocol/networks.js`);
  if (!ret.allout.includes('1 file changed') || ret.code)
    return {error: 'commit failed lib/protocol/networks.js: '+ret.allout};
}
async function git_commitid(){
  let ret = await sys_get(`cd ${cwd}/.. && git rev-parse HEAD`);
  if (ret?.error)
    return ret;
  ret = ret.allout.trim();
  if (ret.length!=40)
    return {error: 'invalid commitid'};
  return ret;
}

async function btc_check_coin(txid, vout){
  let outspend = await fetch_json(
    'https://mempool.space/api/tx/'+txid+'/outspend/'+vout);
  if (outspend?.error)
    return outspend;
  let tx = await fetch_json('https://mempool.space/api/tx/'+txid);
  if (tx?.error)
    return tx;
  return {spent: outspend.spent, value: tx.vout[vout].value};
}

function test_and_create_gen(){ return etask(function*(){
  let do_broadcast_btc = true; // production: true
  let do_commit = true; // production true
  let main_or_test_chain = 'lifcoin_test'; // production: 'lifcoin'
  let error;
  let ret;
  let fee = 732; // 7*(3*2)=7*6=42, 0x732=1842
  console.log('validate setup: btc tip and submit, coin for kv submission');
  let _coin = yield file_json(cwd+'/../../btc_coin.json');
  if (_coin?.error)
    return _coin;
  let {coin, change_addr} = _coin;
  if (coin.txid?.length!=64 || typeof coin.vout!='number' ||
    !coin.keypair.addr || !coin.keypair.priv)
  {
    return {error: 'missing coin fields'};
  }
  console.log('validate keypair can sign');
  let btc_tx_test = yield btc_create_kv({coin, change_addr, fee, log: 0,
    lif_kv: {key: main_or_test_chain+'/block_hash:0',
    val: {hash: 'f'.repeat(32)}}});
  if (!btc_tx_test?.tx_hex || btc_tx_test?.error)
    return btc_tx_test;
  console.log('validate unspent balance');
  let coin_v = yield btc_check_coin(coin.txid, coin.vout);
  if (coin_v?.error)
    return coin_v;
  if (coin_v.spen)
    return {error: 'coin already spent'};
  if (!coin_v.value || coin_v<fee)
    return {error: 'not enought value in coin '+coin_v.value+' < fee '+fee};
  ret = yield git_orig_networks_js();
  if (ret?.error)
    return ret;
  console.log('validate can commit');
  let commitid0 = yield git_commitid(cwd+'/..');
  if (commitid0?.error)
    return commitid0;
  console.log('get updated tip');
  let tip;
  Network.set('lifmain');
  let block_hex;
  let header;
  let found;
  let block;
  for (;;){
    console.log('get updated btc tip');
    tip = yield btc_get_tip();
    if (tip?.error)
      return tip;
    console.log('btc tip', tip);
    console.log('mine new block with new tip');
    block = gen_block('lifmain', {btc_timestamp: tip.id});
    let mine_et = do_mine(block);
    let check_tip_et = etask(function*(){
      for (;;){
        let _tip = yield btc_get_tip();
        if (_tip?.error)
          continue; // ignore
        if (_tip.id!=tip.id){
          console.log('tip changed '+tip.id+' -> '+_tip.id);
          mine_et.return({retry: true});
          return;
        }
        yield etask.sleep(2000);
      }
    });
    found = yield mine_et;
    check_tip_et.return();
    if (found?.retry)
      continue;
    if (!found || found?.error)
      return found;
    block_hex = block.toRaw().toString('hex');
    header = found.header.toString('hex');
    console.log('genesis header:\n', hex_lines(header));
    console.log('genesis block:\n', hex_lines(block_hex));
    console.log('nonce', found.nonce, 'time', found.time);
    console.log('validate btc tip did not change');
    let tip2 = yield btc_get_tip();
    if (tip2?.error)
      return tip2;
    if (tip2.id==tip.id)
      break;
    if (tip2.id!=tip.id){
      console.log('btc tip changed after mining '+tip.id+' -> '+tip2.id);
      return {error: 'tip changed after mining'};
    }
  }
  Network.set(); // return it to BTC to broadcast btc tx
  console.log('update lib/protocol/networks.js with new values');
  let magic = magic_from_hash(found.hash);
  let merkleRoot_hex = buf_to_hex(block.merkleRoot);
  ret = yield update_networks_js({genesisBlock: block_hex,
    time: found.time, nonce: found.nonce,
    merkleRoot: merkleRoot_hex, hash: found.hash, magic});
  if (ret?.error)
    return ret;
  let commitid;
  if (do_commit){
    console.log('commit new genesis block');
    ret = yield git_commit_networks_js(found.hash);
    if (ret?.error)
      return ret;
    console.log('get git commitid to include in BTC KV');
    commitid = yield git_commitid(cwd+'/..');
    if (commitid?.error)
      return commitid;
    console.log('commitid: '+commitid);
  }
  console.log('create BTC KV transaction with lifocin/block_hash@0');
  let btc_tx = yield btc_create_kv({coin, change_addr, fee,
    lif_kv: {
      key: main_or_test_chain+'/block_hash@0',
      val: {
        hash: found.hash,
        miner_app: 'lif:git/github/lif-zone/lif-coin@'+commitid,
      },
    }});
  if (!btc_tx?.tx_hex || btc_tx?.error)
    return btc_tx;
  if (do_broadcast_btc){
    console.log('submit new BTC tx');
    let ret = yield btc_post_tx(btc_tx.tx_hex);
    if (ret.error)
      return ret;
  } else
    console.log('disabled submit: didnt submit new BTC tx');
  console.log('broadcast txid', btc_tx.tx.rhash());
  console.log('SUCCESS');
}); }

async function main(){
  let argv = process.argv;
  if (argv.includes('test'))
    await do_test({mine: true});
  else if (argv.includes('gen')){
    let ret;
    try {
      ret = await test_and_create_gen();
    } catch(error){
      return console.log(error);
    }
    console.log(ret);
  } else
    console.log('invalid command: test|gen');
  process.exit(0);
}

if (!process.browser)
  await main();

