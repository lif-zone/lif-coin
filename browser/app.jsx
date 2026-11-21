import React, {useState, useEffect, useRef, useCallback} from 'react';
import './node_env.js';
process.env.BCOIN_WORKER_FILE = import.meta.resolve('../lib/workers/worker.js');
process.argv = ['lif-coin'];
import fs from "./fs.js";
import {html_elm} from 'lif-kernel/util';
import {connect} from 'net';

// Load Progress
function load_progress(){
  let elm = html_elm('div', {id: 'lif-loader', style:
    'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;'
    +'align-items:center;justify-content:center;font-family:sans-serif;'
    +'color:#888;font-size:14px;pointer-events:none;z-index:1000'});
  let txt = document.createTextNode('Loading…');
  elm.appendChild(txt);
  document.body.appendChild(elm);
  let last, diff;
  let iv = setInterval(async()=>{
    let stats = await globalThis.$lif.boot.kernel_stats();
    let all = stats?.fetch?.all;
    if (all==null || all==last)
      return;
    if (last==null)
      diff = all;
    last = all;
    txt.textContent = 'Loading… '+(all-diff);
  }, 200);
  return {
    elm,
    remove(){
      if (this.removed)
        return;
      this.removed = true;
      clearInterval(iv);
      elm.remove();
    },
  };
}

// Log
const MAX_LOG = 500;
let log_lines = [];
let log_listener;

function log_add(line){
  log_lines.push(line);
  if (log_lines.length>MAX_LOG)
    log_lines = log_lines.slice(-MAX_LOG);
  log_listener?.();
}

import Logger from 'blgr';
function make_logger(){
  let logger = new Logger({level: 'debug', console: true});
  logger.writeConsole = function(level, module, args){
    let name = Logger.levelsByVal[level];
    let msg = this.fmt(args, false);
    let prefix = module ? `[${name}] (${module}) ` : `[${name}] `;
    log_add(prefix+msg);
  };
  logger.warn = logger.warning;
  return logger;
}
let g_logger = make_logger();
let con = g_logger;

window.onunhandledrejection = function(event){
  con.error('unhandled rejection: '+event.reason);
  throw event.reason;
};

// Node
let node_ref = null;

async function start_node(coin){
  con.log('Loading...');
  let lp = load_progress();
  let mod;
  try {
    mod = coin=='btc'
      ? await import('../bin/btc_node.js')
      : await import('../bin/lif_node.js');
  } catch(e){
    con.error('load failed: '+e);
    throw e;
  } finally {
    lp.remove();
  }
  con.log('Running');
  await mod.main(['node', coin+'_node.js'], {logger: g_logger,
    createSocket: connect});
  node_ref = mod.get_node?.();
}

// URL
function url_coin(){
  let path = location.pathname;
  if (path=='/btc')
    return 'btc';
  return 'lif';
}

function url_screen(){
  if (location.pathname=='/options')
    return 'options';
  return 'main';
}

function url_auto(){
  return location.search=='?start';
}

function set_url(path, replace){
  if (location.pathname+location.search==path)
    return;
  if (replace)
    history.replaceState(null, '', path);
  else
    history.pushState(null, '', path);
}

// RPC
async function rpc_exec(cmd_text){
  if (!node_ref?.rpc)
    return {error: 'node not running'};
  let argv = cmd_text.trim().split(/\s+/);
  let method = argv.shift();
  let params = argv.map(arg=>{
    try { return JSON.parse(arg); }
    catch(e){ return arg; }
  });
  return await node_ref.rpc.execute({method, params});
}

// App
const App = ()=>{
  let [coin, setCoin] = useState(url_coin);
  let [running, setRunning] = useState(false);
  let [screen, setScreen] = useState(url_screen);
  let [logText, setLogText] = useState('');
  let [rpcCmd, setRpcCmd] = useState('');
  let [rpcResult, setRpcResult] = useState('');
  let logRef = useRef(null);

  // sync log_lines to state
  useEffect(()=>{
    log_listener = ()=>setLogText(log_lines.join('\n'));
    return ()=>{ log_listener = null; };
  }, []);

  // auto scroll log
  useEffect(()=>{
    let el = logRef.current;
    if (el)
      el.scrollTop = el.scrollHeight;
  }, [logText]);

  // handle popstate
  useEffect(()=>{
    let on_pop = ()=>{
      let path = location.pathname;
      if (path=='/options')
        setScreen('options');
      else {
        setScreen('main');
        if (!running)
          setCoin(url_coin());
      }
    };
    window.addEventListener('popstate', on_pop);
    return ()=>window.removeEventListener('popstate', on_pop);
  }, [running]);

  // auto-start on ?start
  let started = useRef(false);
  useEffect(()=>{
    if (started.current)
      return;
    if (url_auto()){
      started.current = true;
      do_start(coin);
    }
  }, []);

  let do_start = useCallback(async(c)=>{
    if (running)
      return;
    setRunning(true);
    set_url('/'+c+'?start', true);
    try {
      await start_node(c);
    } catch(e){
      con.error(e);
      setRunning(false);
    }
  }, [running]);

  let do_stop = useCallback(()=>{
    location.href = '/'+coin;
  }, [coin]);

  let select_coin = useCallback((c)=>{
    setCoin(c);
    if (running)
      location.href = '/'+c;
    else
      set_url('/'+c);
  }, [running, coin]);

  let go_options = useCallback(()=>{
    setScreen('options');
    set_url('/options');
  }, []);

  let go_back = useCallback(()=>{
    setScreen('main');
    let path = '/'+coin;
    if (running)
      path += '?start';
    set_url(path);
  }, [coin, running]);

  let do_rpc = useCallback(async(e)=>{
    e.preventDefault();
    if (!rpcCmd.trim())
      return;
    setRpcResult('running...');
    try {
      let result = await rpc_exec(rpcCmd);
      setRpcResult(JSON.stringify(result, null, 2));
    } catch(e){
      setRpcResult('Error: '+(e.message||e));
    }
  }, [rpcCmd]);

  if (screen=='options')
    return (<div style={{padding: 20, fontFamily: 'monospace'}}>
      <h2>Options</h2>
      <button onClick={go_back}>&larr; Back</button>
      <div style={{marginTop: 20}}>
        <form onSubmit={do_rpc}>
          <input type="text" value={rpcCmd}
            onChange={e=>setRpcCmd(e.target.value)}
            placeholder="RPC command (e.g. getblockchaininfo)"
            style={{width: '60%', fontFamily: 'monospace', padding: 4}} />
          <button type="submit" style={{marginLeft: 8}}>Run</button>
        </form>
        {rpcResult && <pre style={{
          marginTop: 10, padding: 10, border: '1px solid #ccc',
          maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>{rpcResult}</pre>}
      </div>
    </div>);

  return (<div style={{padding: 20, fontFamily: 'monospace'}}>
    <h1 style={{fontSize: '2em', margin: '10px 0'}}>
      <img src="/.lif/npm/lif-kernel/lif.svg" style={{height: '1.2em',
        verticalAlign: 'middle', marginRight: 8}} />
      Lifcoin, the browser full node</h1>
    <div style={{margin: '10px 0'}}>
      <label style={{marginRight: 20, cursor: 'pointer'}}>
        <input type="radio" name="coin" value="lif"
          checked={coin=='lif'}
          onChange={()=>select_coin('lif')} />
        {' '}Lifcoin
      </label>
      <label style={{cursor: 'pointer'}}>
        <input type="radio" name="coin" value="btc"
          checked={coin=='btc'}
          onChange={()=>select_coin('btc')} />
        {' '}Bitcoin
      </label>
    </div>
    <div style={{margin: '10px 0'}}>
      {running
        ? <><button onClick={do_stop}>Stop</button>
          <span style={{marginLeft: 10, color: 'green'}}>Running...</span></>
        : <button onClick={()=>do_start(coin)}>Start</button>}
      {running && <button onClick={go_options}
        style={{marginLeft: 10}}>Options</button>}
    </div>
    <textarea ref={logRef} readOnly value={logText}
      style={{
        width: '100%', height: '70vh', fontFamily: 'monospace',
        fontSize: '0.85em', padding: 5, border: '1px solid #999',
        whiteSpace: 'pre', resize: 'vertical', boxSizing: 'border-box',
      }} />
  </div>);
};

export default App;
