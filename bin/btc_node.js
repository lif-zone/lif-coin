#!/usr/bin/env node
'use strict';
process.title = 'btc_node';
import '../browser/browser_env.js';
import Network from '../lib/protocol/network.js';
import FullNode from '../lib/node/fullnode.js';
import Address from '../lib/primitives/address.js';
import {ewait} from 'lif-kernel/util.js';
import assert from 'bsert';
import {readFileSync} from 'fs';

// test address: all all all all all all all all all all all all
let test_address = 'bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk';
let default_address = 'bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk';
let mine_address;

process.on('unhandledRejection', (err, promise)=>{
  console.error(err);
  throw err;
});
process.on('SIGINT', async()=>{
  await node.close();
});

async function Ewait(e, name){
  let wait = ewait();
  e.once(name, a=>wait.return(a));
  return await wait;
}
async function wait_for_sync_full(){
  console.log('waiting for full');
  console.log(node.chain.isFull());
  let ret = await Ewait(node, 'full');
  console.log('got full');
}
let node;
async function start(opt={}){
  console.log(`Mining address: ${mine_address}`);
  node = new FullNode({
    network: 'main',
    file: false,
    argv: [],
    env: true,
    logFile: true,
    logConsole: true,
    logLevel: 'info',
    memory: false,
    workers: true,
    listen: true,
    prefix: '~/lif.store',
    coinbaseFlags: 'mined by lif-coin',
    'index-tx': true,
    'index-address': true,
    'index-addrsh': true,
    //'reject-absurd-fees': false,
    cors: true,
    'coinbase-address': [mine_address],
    'persistent-mempool': true,
    'require-standard': false,
    incoming_sync: true,
    assist_before_sync: true,
    //hash: true,
    //query: true,
    //prune: true,
    ...opt,
  });
  await node.ensure();
  await node.open({addr_rescan: false});
  await node.connect();
  await node.startSync();
  if (0) await wait_for_sync_full();
}

function exit(err){
  console.error(err);
  process.exit(1);
}
function usage(err){
  console.log('node btc_node.js [OPTS]');
  console.log('');
  console.log('--address ADDRESS: the mining address to get 10% of block reward');
  console.log('--address-test: mnemonic all all all all all all all all all all all all');
  console.log('--address-default: default donation address');
  console.log('--address-file FILE: json file: field: mine_address');
  process.exit(1);
}
export function get_node(){ return node; }
export async function main(argv, opt){
  argv ||= process.argv;
  let i = 2;
  for (; i<argv.length;){
    let a = argv[i++];
    if (a=='--address'){
      let address = argv[i++];
      if (!address)
        return exit('no address');
      let addr = new Address(address);
      if (!addr)
        exit('invalid addr');
      mine_address = addr.address;
    } else if (a=='--address-default')
      mine_address = default_address;
    else if (a=='--address-test')
      mine_address = test_address;
    else if (a=='--address-file')
      mine_address = JSON.parse(readFileSync(argv[i++], 'utf8')).mine_address;
    else
      return usage();
  }
  if (argv.length!=i)
    return usage();
  mine_address ||= default_address;
  await start(opt);
}
if (!process.browser)
  main();

