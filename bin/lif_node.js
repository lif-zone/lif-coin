#!/usr/bin/env node
'use strict';
process.title = 'lif_node';
import '../browser/browser_env.js';
import Network from '../lib/protocol/network.js';
Network.set('lifmain');
import FullNode from '../lib/node/fullnode.js';
import Address from '../lib/primitives/address.js';
import {ewait} from 'lif-kernel/util.js';
import assert from 'bsert';
import {readFileSync} from 'fs';

let dna = 'DNAINDIVIDUALTRANSPARENTEFFECTIVEIMMEDIATEAUTONOMOUSINCREMENTALRESPONSIBLEACTIONTRUTHFUL';
// test address: all all all all all all all all all all all all
let test_address = 'lif1qt59xsv4dwu2pwqkyxxcwrc3atlwwcjajhzhvze';
let default_address = 'lif1qpxrahj5ca4dwhk3jt9hlrlmudzn4anj287mjr4';
let mine_address;

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
async function start(){
  console.log(`Mining address: ${mine_address}`);
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
  console.log('node lif_node.js [OPTS]');
  console.log('');
  console.log('--address ADDRESS: the mining address to get 10% of block reward');
  console.log('--address-test: mnemonic all all all all all all all all all all all all');
  console.log('--address-default: default donation address');
  console.log('--address-file FILE: json file: field: mine_address');
  process.exit(1);
}
export async function main(){
  let argv = process.argv;
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
  await start();
}
if (!process.browser)
  main();

