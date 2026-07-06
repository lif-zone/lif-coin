#!/usr/bin/env node
'use strict';
process.title = 'lif_node';
import '../browser/browser_env.js';
import Network from '../lib/protocol/network.js';
Network.set('lifmain');
import FullNode from '../lib/node/fullnode.js';
import Miner from '../lib/mining/miner.js';
import Mnemonic from '../lib/hd/mnemonic.js';
import HDPrivateKey from '../lib/hd/private.js';
import KeyRing from '../lib/primitives/keyring.js';
import Address from '../lib/primitives/address.js';
import Script from '../lib/script/script.js';
import MTX from '../lib/primitives/mtx.js';
import Coin from '../lib/primitives/coin.js';
import {ewait} from 'lif-kernel/util.js';
import assert from 'bsert';

function bech32(mnemonic, net){
  let _mnemonic = Mnemonic.fromPhrase(mnemonic);
  let coinType = Network.get(net).keyPrefix.coinType;
  let hdPrivKey = HDPrivateKey.fromMnemonic(_mnemonic);
  let derivedKey = hdPrivKey.derive(84, true)
  .derive(coinType, true).derive(0, true).derive(0).derive(0);
  let keyRing = new KeyRing({privateKey: derivedKey.privateKey,
    witness: true});
  let address = keyRing.getKeyAddress('string', net);
  let a = new Address(address, net);
  return {
    mn: mnemonic, // for dev
    privateKey: derivedKey.privateKey.toString('hex'),
    publicKey: keyRing.publicKey.toString('hex'),
    address: address,
    keyRing: keyRing,
    a,
  };
}

let wallet1 = bech32('six clip senior spy fury aerobic volume sheriff critic number feature inside');
let wallet2 = bech32('morning like hello gym core stage wood deposit artefact monster turn absorb');
let wallet3 = bech32('all all all all all all all all all all all all');
import sha256 from 'bcrypto/lib/sha256.js';
function electrum_from_addr(addr){
  return Script.fromAddress(addr).sha256().reverse().toString('hex');
}
function scripthash_from_addr(addr){
  return Script.fromAddress(addr).sha256().toString('hex');
}
function test(){
  let t = (net, addr)=>assert.strictEqual(bech32(wallet1.mn, net).address, addr);
  t('main', 'bc1qe5trcka3qtt2ll8exe3xmt7qzyjjp6dfqp76xr');
  t('testnet', 'tb1q6slygtjxpnuh4dck09wpgq254q6wu86ahuc7dc');
  t('lifmain', 'lif1qsut4mudgtnrelzssdtnh48ep8nyz8nrlzjqw0g');
  t = (net, addr)=>assert.strictEqual(bech32(wallet3.mn, net).address, addr);
  t('main', 'bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk');
  t('lifmain', 'lif1qt59xsv4dwu2pwqkyxxcwrc3atlwwcjajhzhvze');
  t = (net, electrum_hash)=>assert.strictEqual(
    electrum_from_addr(bech32(wallet3.mn, net).a), electrum_hash);
  t('main', '4f7a209e53b64b1d720effb12f5896f5f923c5ba2e5c835c9a186f909d3b2c10');
  t('lifmain', '29780aa1a0a98fb08a252f3ec9b02ec95197e9321186e48398d409b11e39b83d');
  t = (net, electrum_hash)=>assert.strictEqual(
    scripthash_from_addr(bech32(wallet3.mn, net).a), electrum_hash);
  t('main', '102c3b9d906f189a5c835c2ebac523f9f596582fb1ff0e721d4bb6539e207a4f');
  t('lifmain', '3db8391eb109d49883e4861132e99751c92eb0c93e2f258ab08fa9a0a10a7829');
  t = (hex, asm)=>assert.strictEqual(Script.fromJSON(hex).toASM(), asm);
  t('6a24aa21a9ed2b4c76989d6e5898c6a68218351815f555842ce24410a1da74fa774d8836e60d',
    'OP_RETURN OP_PUSHBYTES36 aa21a9ed2b4c76989d6e5898c6a68218351815f555842ce24410a1da74fa774d8836e60d');
  t('6a036c6966036b657901610376616c0162',
    'OP_RETURN OP_PUSHBYTES3 6c6966 OP_PUSHBYTES3 6b6579 OP_PUSHBYTES1 61 OP_PUSHBYTES3 76616c OP_PUSHBYTES1 62');
}
test();

let dna = 'DNAINDIVIDUALTRANSPARENTEFFECTIVEIMMEDIATEAUTONOMOUSINCREMENTALRESPONSIBLEACTIONTRUTHFUL';
let mine_address = wallet3.address;
console.log(`Mining address calculated: ${mine_address}`);

let node = new FullNode({
  network: 'lifmain', // 'main'
  file: false,
  argv: [],
  env: true,
  logFile: true,
  logConsole: true,
  logLevel: 'info',
  memory: false,
  workers: true,
  listen: true,
  //loader: require,
  prefix: '~/lif.store',
  coinbaseFlags: 'mined by lif-coin',
  'index-tx': true,
  'index-address': true,
  'index-addrsh': true,
  lif_kv_idx: true,
  'reject-absurd-fees': false,
  cors: true,
  'coinbase-address': [mine_address],
  'persistent-mempool': true,
  'require-standard': false,
  incoming_sync: true,
  assist_before_sync: true,
});

async function mine_blocks(n){
  let chain = node.chain, mempool = node.mempool;
  let miner = new Miner({chain, mempool});
  let entries = [];
  let miningAddress = new Address(mine_address);
  console.log(`Mining ${n} blocks to address: ${mine_address}`);
  for (let i=0; i < n; i++){
    let job = await miner.cpu.createJob(null, miningAddress);
    // Mine blocks all ten minutes apart from regtest genesis
    //job.attempt.time = chain.tip.time + (60 * 10); // fake time
    let block = await job.mineAsync();
    console.log(`Mined block ${i + 1}/${n}: ${block.hash().toString('hex')}`);
    let entry = await chain.add(block);
    entries.push(entry);
  }
  console.log(`Successfully mined ${n} blocks!`);
  return entries;
}

process.on('unhandledRejection', (err, promise)=>{
  console.error(err);
  throw err;
});
process.on('SIGINT', async()=>{
  await node.close();
});

async function Ewait(e, name){
  let wait = ewait();
  e.once('name', a=>wait.return(a));
  return await wait;
}
async function wait_for_sync_full(){
  console.log('waiting for full');
  console.log(node.chain.isFull());
  let ret = await Ewait(node, 'full');
  console.log('got full');
}
async function start(){
  await node.ensure();
  await node.open({addr_rescan: false});
  await node.connect();
  await node.startSync();
  //await wait_for_sync_full();
}

function mtx_fund(mtx, {coins, fee, change}){
  let out_val = fee;
  for (let out of mtx.outputs)
    out_val += out.value;
  // Add coins to transaction.
  let in_val = 0;
  for (let coin of coins){
    mtx.addCoin(coin);
    in_val += coin.value;
    if (in_val>=out_val)
      break;
  }
  if (in_val<out_val){
    console.error('not enough funds. need '+out_val+' got only '+in_val);
    throw 'not enough funds';
  }
  if (in_val>out_val){
    assert(change, 'tx change: missing change addr');
    mtx.addOutput({address: change, value: in_val-out_val});
    mtx.changeIndex = mtx.outputs.length-1;
  }
}

async function tx_get_coins_by_addr(txm, addr, spent){
  let coins = [], coin;
  for (let i=0; i<txm.tx.outputs.length; i++) {
    let a = txm.tx.outputs[i].getAddress();
    if (!a||!a.equals(addr))
      continue;
    if (spent){ // include also spent coins
      coins.push(Coin.fromTX(txm.tx, i, txm.height));
      continue;
    }
    if (!(coin = await node.chain.getCoin(txm.tx.hash(), i)))
      continue;
    coins.push(coin);
  }
  return coins;
}
async function node_get_coins(addr){
  let txs = await node.getMetaByAddrSH(addr, {limit: 10000});
  let coins = [];
  for (let t of txs)
    coins.push(...await tx_get_coins_by_addr(t, addr, false));
  return coins;
}

function coins_print(coins, s){
  s ||= '';
  for (let c of coins)
    console.log(s+'coin height', c.height, 'value', c.value);
  let funds = coins.reduce((v, coin)=>v+coin.value, 0);
  console.log(s+'total coins', coins.length, 'value', funds);
}

async function wallet_addr_coins_print(addr, s){
  let coins = await node_get_coins(addr);
  coins_print(coins, s);
}

async function mtx_send_create({from, from_key, to, value, change, fee}){
  let mtx = new MTX();
  let send = 10000;
  let coins = await node_get_coins(from);
  await wallet_addr_coins_print(from, 'wallet from: ');
  await wallet_addr_coins_print(to, 'wallet to: ');
  mtx.addOutput({address: to, value});
  change ||= from;
  mtx_fund(mtx, {coins, fee, change});
  mtx.sign(from_key);
  assert(mtx.verify());
  let tx = mtx.toTX();
  assert(tx.verify(mtx.view));
  return mtx;
}

async function send_tx(){
  let mtx = await mtx_send_create({from: wallet3.a, from_key: wallet3.keyRing,
    to: wallet2.a, value: 10000, fee: 1000});
  let tx = mtx.toTX();
  assert(tx.verify(mtx.view));
  let res = await node.sendTX(tx);
  if (+process.env.mine)
    await mine_blocks(1);
}

async function recheck_blocks(){
  let chain = node.chain;
  let pow = chain.network.pow;
  let tip = chain.tip;
  console.log('rechecking blocks 1..'+tip.height);
  console.log('pow.bits='+pow.bits.toString(16)+' pow.limit='+pow.limit.toString('hex'));
  let bad = 0;
  for (let h=1; h<=tip.height; h++){
    let entry = await chain.db.getEntryByHeight(h);
    let prev = await chain.db.getEntryByHeight(h-1);
    let expected_bits = await chain.getTarget(entry.time, prev);
    if (entry.bits !== expected_bits){
      console.error('BAD block height='+h+' bits=0x'+entry.bits.toString(16)
        +' expected=0x'+expected_bits.toString(16));
      bad++;
    }
  }
  if (!bad)
    console.log('all blocks OK');
  else
    console.log(bad+' bad blocks found');
}

export async function main(){
  await start();
  if (+process.env.recheck)
    await recheck_blocks();
  if (+process.env.mine)
    await mine_blocks(1);
  if (+process.env.tx)
    await send_tx();
}
if (!process.browser)
  main();

