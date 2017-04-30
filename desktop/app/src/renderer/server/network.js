import net from 'net';

import * as protocol from '../../../../../server/src/lib/protocol';
import CallbackHub from '../../../../../server/src/lib/callback-hub';

const BUFFER_SIZE = 10240;

const createBuffer = () => ({
  bufferLow: 0,
  bufferHigh: 0,
  readBuffer: Buffer.allocUnsafe(BUFFER_SIZE),
  writeBuffer: Buffer.allocUnsafe(BUFFER_SIZE),
});

class ServerConnection {
  constructor(host, port, sock) {
    this.callbackHub = new CallbackHub();
    this.host = host;
    this.sock = sock;
    this.port = port;
    this.buffer = createBuffer();
    this.timer = 0;

    this.sock.on('close', () => this.onClose());
    this.sock.on('timeout', () => this.onError('timeout'));
    this.sock.on('data', data => this.onData(data));

    this.bindPacketHandler();

    this.startPing();
  }

  register(user, pass) {
    return new Promise((res, rej) => {
      this.sock.write(protocol.makePacket(protocol.packetType.USER_ADD_REQ, {
        name: user,
        token: pass,
      }));
      this.sock.once('error', e => rej(e));
      this.callbackHub.listenOnce(protocol.packetType.USER_ADD_RESP.type, (data) => {
        console.log(data);
        res(data);
      });
    });
  }

  login(user, pass) {
    return new Promise((res, rej) => {
      this.sock.write(protocol.makePacket(protocol.packetType.USER_LOGIN_REQ, {
        name: user,
        token: pass,
      }));
      this.sock.once('error', e => rej(e));
      this.callbackHub.listenOnce(protocol.packetType.USER_LOGIN_RESP.type, (data) => {
        console.log(data);
        res(data);
      });
    });
  }

  onError(err) {
    console.log(err.name, err.message, err.stack);
    this.stopPing();
  }

  onClose() {
    console.log('connection closed');
    this.callbackHub.pub('connection-close');
    this.stopPing();
  }

  onData(buffer) {
        // Copy buffer
    if (this.buffer.readBuffer.length - this.buffer.bufferHigh < buffer.length) {
      if (this.buffer.readBuffer.length >
        this.buffer.bufferHigh - this.buffer.bufferLow + buffer.length) {
        this.buffer.readBuffer.copy(
          this.buffer.readBuffer, 0, this.buffer.bufferLow, this.buffer.bufferHigh);
        this.buffer.bufferHigh -= this.buffer.bufferLow;
        this.buffer.bufferLow = 0;
      } else {
        console.error('large package size');
        // TODO: close this connection since the state of this connection is unstable
        return;
      }
    }
    buffer.copy(this.buffer.readBuffer, this.buffer.bufferHigh, 0, buffer.length);
    this.buffer.bufferHigh += buffer.length;

    // loop to abstract all the incomplete packets
    for (; ;) {
      const status = protocol.checkPacket(
        this.buffer.readBuffer, this.buffer.bufferLow, this.buffer.bufferHigh);

      if (!status.valid) {
        // clean the buffer
        this.callbackHub.pub('data-error', { message: 'invalid buffer' });
        this.buffer.bufferLow = this.buffer.bufferHigh = 0;
        break;
      }

      if (!status.complete) { break; }

      const { data: { type, payload }, length } = protocol.readPacket(
        this.buffer.readBuffer, this.buffer.bufferLow, this.buffer.bufferHigh);

      this.buffer.bufferLow += length;
      if (this.buffer.bufferLow === this.buffer.bufferHigh) {
        this.buffer.bufferLow = this.buffer.bufferHigh = 0;
      }

      console.log(type, payload);
      this.callbackHub.pub(type.type || type, [payload]);
    }
  }

  startPing() {
    this.stopPing();
    this.timer = setInterval(() =>
      this.sock.write(protocol.makePacket(protocol.packetType.SERVER_CHECK)), 1200);
  }

  stopPing() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  bindPacketHandler() {
    this.callbackHub.listen(protocol.packetType.MSG_RECV.type, msg => {
      this.callbackHub.pub('data-message', { user: '', message: msg });
    });
    this.callbackHub.listen(protocol.packetType.INFO_RESP, info => {
      switch (info.type) {
        case 'buddy-list':
          this.callbackHub.pub('data-buddy-hub', info.data);
          break;
        default:
          console.log('unknown info received', info.type, info.data);
      }
    });
  }

  on(event, callback) {
    this.callbackHub.listen(event, callback);
  }
}

export const createSock = (host, port) => new Promise((res, rej) => {
  const sock = net.createConnection({ port, host }, (err) => {
    if (err) {
      console.log('failed to connect to server', err);
      rej(err);
      return;
    }

    console.log('connected to server');
    res(new ServerConnection(host, port, sock));
  });
  sock.once('error', e => {
    rej(e);
  });
});