#!/usr/bin/env node
const readline = require('readline');
const net = require('net');
const dgram = require('dgram');
const WebSocket = require('ws');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.clear();
console.log(`
╔══════════════════════════════════╗
║       McCrossCheck 三合一        ║
╠══════════════════════════════════╣
║  1. WebSocket (wss://)           ║
║  2. Java Edition (TCP)          ║
║  3. Bedrock Edition (UDP)       ║
╚══════════════════════════════════╝
`);

rl.question('请选择 (1/2/3): ', choice => {
  const mode = choice.trim();
  const defaultPorts = { '1': 443, '2': 25565, '3': 19132 };
  const defaultPort = defaultPorts[mode] || 25565;

  rl.question('目标地址 (IP或域名): ', host => {
    rl.question(`端口 (默认 ${defaultPort}): `, portInput => {
      const port = portInput.trim() === '' ? defaultPort : parseInt(portInput) || defaultPort;

      switch (mode) {
        case '1':
          testWebSocket(host, port);
          break;
        case '2':
          testJava(host, port);
          break;
        case '3':
          testBedrock(host, port);
          break;
        default:
          console.log('❌ 无效选择');
          rl.close();
      }
    });
  });
});

// ─── WebSocket 测试 ───
function testWebSocket(host, port) {
  const url = `wss://${host}:${port}`;
  console.log(`\n🔗 正在连接 WebSocket: ${url}`);
  const start = Date.now();
  const ws = new WebSocket(url);

  ws.on('open', () => {
    const latency = Date.now() - start;
    console.log(`✅ WebSocket 连接成功`);
    console.log(`⏱ 延迟: ${latency}ms`);
    ws.close();
    rl.close();
  });

  ws.on('error', err => {
    console.log(`❌ 连接失败: ${err.message}`);
    rl.close();
  });

  ws.on('unexpected-response', () => {
    const latency = Date.now() - start;
    console.log(`⚠️  服务器响应了但非 WebSocket 协议 (延迟 ${latency}ms)`);
    rl.close();
  });

  setTimeout(() => {
    console.log('⏰ 超时 (5s)');
    ws.close();
    rl.close();
  }, 5000);
}

// ─── Java (TCP) 测试 ───
function testJava(host, port) {
  console.log(`\n🔍 测试 Java (TCP): ${host}:${port}`);
  const start = Date.now();
  const sock = net.createConnection({ host, port, timeout: 4000 });

  sock.on('connect', () => {
    const latency = Date.now() - start;
    console.log(`✅ TCP 连接成功`);
    console.log(`⏱ 延迟: ${latency}ms`);
    sock.destroy();
    rl.close();
  });

  sock.on('error', err => {
    console.log(`❌ 连接失败: ${err.message}`);
    rl.close();
  });

  sock.on('timeout', () => {
    console.log('⏰ 超时 (4s)');
    sock.destroy();
    rl.close();
  });
}

// ─── Bedrock (UDP) 测试 ───
function testBedrock(host, port) {
  console.log(`\n🔍 测试 Bedrock (RakNet): ${host}:${port}`);
  const start = Date.now();
  const socket = dgram.createSocket('udp4');
  const buf = Buffer.from([
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  socket.send(buf, 0, buf.length, port, host, err => {
    if (err) {
      console.log(`❌ 发送失败: ${err.message}`);
      socket.close();
      rl.close();
    }
  });

  socket.on('message', msg => {
    const latency = Date.now() - start;
    if (msg[0] === 0x1c) {
      console.log(`✅ Bedrock 服务器响应`);
      console.log(`⏱ 延迟: ${latency}ms`);
    } else {
      console.log(`⚠️  收到未知响应 (延迟 ${latency}ms)`);
    }
    socket.close();
    rl.close();
  });

  setTimeout(() => {
    console.log('⏰ 超时 (4s)');
    socket.close();
    rl.close();
  }, 4000);
}
