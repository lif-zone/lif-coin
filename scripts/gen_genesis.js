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
import {readFile} from 'fs/promises';
import {homedir} from 'os';
import etask from 'lif-kernel/etask';
const {wait: ewait} = etask;
import {lifnet_connect} from 'lif-kernel/lifnet';

function buf_from_hex(b){
  if (Buffer.isBuffer(b))
    return Buffer.from(b);
  return Buffer.from(b, 'hex');
}
function buf_to_hex(b){
  b = Buffer.from(b);
  return b.toString('hex');
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
    flags = 't1 The Guide 08/ALU/5786 KI TXA Ethernal Names Philology DNA/Shoshani';
    //flags = 'The Guide 21/TSR/5787 SMhT TURA Ethernal Names Philology DNA/Shoshani';
  // The Counter HSUPR
  // How many sentences? how many words? how many letters?
  // with JPG: Ben Shoshan on Counter Helpers work
  if (!flags)
    flags = 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks';
  if (typeof flags=='string')
    flags = Buffer.from(flags, 'ascii');
  if (!key) {
    key = buf_from_hex(''
      + '04678afdb0fe5548271967f1a67130b7105cd6a828e039'
      + '09a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c3'
      + '84df7ba0b8d578a4c702b6bf11d5f');
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
  const block = new Block({
    version: opt.version,
    prevBlock: consensus.ZERO_HASH,
    merkleRoot: tx.hash(),
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
  return net.genesis_block = createGenesisBlock(
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
      console.log(err='ERR target not reached:', '0x'+block.bits.toString(16),
        common.getTarget(block.bits));
      mine_err = true;
    }
  }
  console.log('genesis.hash orig:', h_orig);
  if (g.bits!=pow.bits)
    console.log(err='ERR bits mismatch', g.bits.toString(16), pow.bits.toString(16));
  let calc_bits = consensus.toCompact(pow.limit);
  if (calc_bits!=pow.bits)
    console.log(err='ERR limit mismatch: pow.bits='+pow.bits.toString(16)+' compact(limit)='+calc_bits.toString(16));
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
function magic_calc(){
  return; // XXX remove before mainnet release
  let whoami = 'IBEYOURGODDONTCREATEOTHERGODSOVERMEDONTUSEBEYOURGODSNAMEINVAINREMEMBERTODEDICATETHESATURDAYHONORYOURFATHERANDMOTHERDONTMURDERDONTBETRAYDONTSTEALDONTACCUSEBYLIESDONTGREEDFELLOWSHOME';
  let yekum = hash256lif.digest(Buffer.from(whoami, 'ascii')).slice(0, 4).reverse().toString('hex');
  let _yekum = +('0x'+yekum);
  if ((+_yekum)!=0x0eca929b)
    console.log('lifmain magic', '0x'+yekum);
  let net = Networks.lifmain;
  if (_yekum != net.magic){
    console.log('ERROR', yekum, net.magic.toString(16));
    return 'ERR magic';
  }
}
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
  return yield done;
}); }

let enable_slave = process.env.MINE_SLAVE;
async function do_mine(block){
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
  let target = common.getTarget(block.bits);
  target = common.getTarget(0x1f00ffff);
  console.log('difficulty:', block.bits.toString(16), target.toString('hex'));
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
    if (enable_slave)
      nonce = mine_slave({header, target, min: i, max: _max, time});
    else
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
  console.log('SUCCESS: nonce='+nonce, 'header=', header.toString('hex'),
    'hash', hash);
  return {nonce, time, header, hash};
}

export async function do_test(){
  let error;
  await diff_block('main');
  Network.set('lifmain');
  error ||= magic_calc();
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
    let ret = await fetch('https://mempool.space/api/v1/blocks');
    let json = await ret.json();
    return json;
  } catch(error){
    console.log('failed fetch '+url, error);
    return {error};
  }
}
async function btc_fetch_tip(url, cmp){
  let _tip = await fetch_json('https://mempool.space/api/v1/blocks');
  let tip = {id: _tip[0].id, height: _tip[0].height};
  if (!tip.id || !tip.height)
    return {error: 'failed fetch'};
  if (cmp && (cmp.id!=tip.id || cmp.height!=tip.height)){
    console.log('tip mismatch btcscan', tip, 'orig', cmp);
    return {error: 'tip mismatch'};
  }
  return tip;
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
async function btc_get_tip({test}={}){
  let tip = await btc_fetch_tip('https://mempool.space/api/v1/blocks');
  if (tip.error)
    return tip;
  if (typeof tip.height!='number' || tip<900000 || tip.height>1100000){
    console.log('invalid tip height', tip.height);
    return {error: 'invalid tip height'};
  }
  if (tip.id?.length!=64){
    console.log('invalid tip id', tip.id);
    return {error: 'invalid tip id'};
  }
  if (test){
    let tip2;
    tip2 = await btc_fetch_tip('https://btcscan.org/api/blocks/tip');
    if (tip2.error)
      return tip2;
    // ?cors=true only needed for browsers
    tip2 = await btc_fetch_tip('https://blockchain.info/latestblock?cors=true');
    if (tip2.error)
      return tip2;
    tip2 = await btc_fetch_tip('https://api.blockcypher.com/v1/btc/main');
    if (tip2.error)
      return tip2;
  }
  return tip;
}
async function btc_create_kv({coin, change_addr, fee, lif_timestamp}){
  let timestamp = JSON.stringify({lif_timestamp});
  let kv_script = lif_kv_script({key: 'timestamp', val: timestamp});
  let {keypair, value, outi, txid} = coin;
  let {priv, addr} = keypair;
  let keyRing = new KeyRing({privateKey: Buffer.from(priv, 'hex'),
    witness: true});
  console.log(keyRing.getScriptAddress('base58'));
  let prevHash = Buffer.from(txid, 'hex').reverse();
  let c = Coin.fromOptions({
    hash: prevHash,
    index: outi,
    value,
    script: Script.fromAddress(addr),
  });
  let mtx = new MTX();
  mtx.addCoin(c);
  let change_script = Script.fromAddress(change_addr);
  mtx.addOutput({value: value - fee, script: change_script});
  mtx.changeIndex = 0;
  mtx.addOutput({value: 0, script: kv_script});
  mtx.sign(keyRing);
  let tx = mtx.toTX();
  let hex = tx.toRaw().toString('hex');
  let _txid = tx.rhash();
  0 && console.log('BTC TX:', mtx.toJSON());
  console.log('BTC TX hex:', hex);
  console.log('BTC TXID:', _txid);
  return {tx, tx_hex: hex, txid: _txid};
}
async function test_and_create_gen(){
  let broadcast_btc = false;
  let error;
  // validate setup: btc tip and submit, coin for kv submission
  let _coin = await file_json(homedir()+'/btc_coin.json');
  if (_coin?.error)
    return _coin;
  let {coin, change_addr, txid, outi} = _coin;
  if (coin.txid?.length!=64 || typeof coin.outi!='number' ||
    !coin.keypair.addr || !coin.keypair.priv)
  {
    console.log('missing coin fields');
    return {error: 'missing coin fields'};
  }
  let tip = await btc_get_tip({test: true});
  if (tip.error)
    return tip;
  // validate current genesis is correct
  Network.set('lifmain');
  if (error=magic_calc())
    return {error};
  if (error=await diff_block('lifmain', {mine: false}))
    return {error};
  // get new btc TIP
  tip = await btc_get_tip();
  if (tip?.error)
    return tip;
  console.log('btc tip', tip);
  // mine new block with new TIP
  let block = gen_block('lifmain', {btc_timestamp: tip.id});
  let ret = await do_mine(block);
  if (ret.error)
    return ret;
  let block_hex = block.toRaw().toString('hex');
  console.log('genesis block:\n', hex_lines(block_hex));
  // create BTC KV transaction with lifocin/block_hash@0
  Network.set(); // return it to BTC to broadcast btc tx
  let btc_tx = await btc_create_kv({coin, change_addr, fee: 1842,
    lif_timestamp: ret.hash});
  if (btc_tx?.error)
    return btc_tx;
  // submit new BTC transaction, using existing btc keypair and coin, as long
  // as no new btc tip has been created
  if (broadcast_btc){
    ret = await btc_post_tx(btc_tx.tx_hex);
    if (ret.error)
      return ret;
  }
  console.log('broadcast txid', btc_tx.tx.rhash());
  console.log('SUCCESS');
}

async function main(){
  let argv = process.argv;
  if (argv.includes('test'))
    await do_test({mine: true});
  else if (argv.includes('gen'))
    await test_and_create_gen();
  else
    console.log('invalid command: test|gen');
  process.exit(0);
}

if (!process.browser)
  main();

