// lifsocket.js - lifnet tcp socket for bcoin
// Replaces proxysocket.js: instead of proxying TCP through a WebSocket
// to server.js, uses lifnet's tcp/out through lif-kernel/net/tcpip.js.
// The real TCP connection is made by a lif-net out node.
import {tcp_sock} from 'lif-kernel/tcpip';

class LIFSocket extends tcp_sock {
  // an 'error' nobody listens to is dropped, not thrown
  emit(event, ...args){
    if (event=='error' && !this.listenerCount('error'))
      return false;
    return super.emit(event, ...args);
  }
  static connect(port, host){
    return new this().connect(port, host);
  }
}

export function createSocket(port, host){
  return LIFSocket.connect(port, host);
}

export default LIFSocket;
