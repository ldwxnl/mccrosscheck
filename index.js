#!/usr/bin/env node
// ============================================================
// McCrossCheck 五合一 · SRV 可视化版
// 支持：HTTP / HTTPS / WebSocket / Java(TCP) / Bedrock(UDP)
// SRV 查询结果会强制打印，让你亲眼看到
// ============================================================

const readline = require('readline');
const net = require('net');
const dgram = require('dgram');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const dns = require('dns');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ─── 颜色工具 ───
const c = {
  r: s => `\x1b[91m${s}\x1b[0m`,
  g: s => `\x1b[92m${s}\x1b[0m`,
  y: s => `\x1b[93m${s}\x1b[0m`,
  c: s => `\x1b[96m${s}\x1b[0m`,
  b: s => `\x1b[1m${s}\x1b[0m`,
  d: s => `\x1b[2m${s}\x1b[0m`
};

console.clear();
console.log(c.c(`
╔══════════════════════════════════════╗
║      ${c.b('McCrossCheck 五合一')}              ║
╠══════════════════════════════════════╣
║  ${c.g('1')}. HTTP                          ║
║  ${c.g('2')}. HTTPS                         ║
║  ${c.g('3')}. WebSocket (wss://)             ║
║  ${c.g('4')}. Java 版 (TCP)                 ║
║  ${c.g('5')}. 基岩版 (UDP)                  ║
╚══════════════════════════════════════╝
`));

rl.question(`${c.b('请选择 (1/2/3/4/5): ')}`, choice => {
  const mode = choice.trim();
  const ports = { '1': 80, '2': 443, '3': 443, '4': 25565, '5': 19132 };
  const defaultPort = ports[mode] || 25565;

  rl.question(`${c.b('目标地址: ')}`, host => {
    rl.question(`${c.d(`端口 (默认 ${defaultPort}，回车自动SRV): `)}`, portInput => {

      if (portInput.trim() === '') {
        // ─── SRV 查询 ───
        const srvTypes = { '4': '_minecraft._tcp', '5': '_minecraft._udp' };
        const srvName = srvTypes[mode] ? `${srvTypes[mode]}.${host}` : null;

        if (srvName) {
          console.log(`\n${c.c('🔎 SRV 查询:')} ${c.b(srvName)}`);
          dns.resolveSrv(srvName, (err, addrs) => {
            if (err) {
              console.log(`${c.r('⚠️  SRV 查询失败:')} ${err.code} — 使用默认端口 ${defaultPort}`);
              startTest(mode, host, defaultPort);
            } else if (addrs && addrs.length > 0) {
              const srv = addrs[0];
              console.log(`${c.g('✅ SRV 命中!')} → ${c.b(srv.name)}:${c.y(srv.port)}`);
              startTest(mode, srv.name, srv.port);
            } else {
              console.log(`${c.y('⚠️  无 SRV 记录，使用默认端口')} ${defaultPort}`);
              startTest(mode, host, defaultPort);
            }
          });
        } else {
          // HTTP/HTTPS/WS 无标准 SRV，直接默认端口
          console.log(`${c.d('ℹ️  该模式无标准 SRV 记录，使用默认端口')} ${defaultPort}`);
          startTest(mode, host, defaultPort);
        }
      } else {
        const port = parseInt(portInput) || defaultPort;
        startTest(mode, host, port);
      }
    });
  });
});

// ─── 启动测试 ───
function startTest(mode, host, port) {
  const tests = {
    '1': () => testHttp(host, port, false),
    '2': () => testHttp(host, port, true),
    '3': () => testWS(host, port),
    '4': () => testJava(host, port),
    '5': () => testBedrock(host, port)
  };
  (tests[mode] || (() => console.log(c.r('无效选择'))))();
}

// ─── 显示结果 ───
function result(type, ok, ms, info) {
  const icon = ok ? c.g('✅') : c.r('❌');
  const lat = ms !== undefined ? ` ${c.y(`${ms}ms`)}` : '';
  const ext = info ? ` ${c.d(`| ${info}`)}` : '';
  console.log(`\n${icon} ${c.b(type)}${lat}${ext}`);
  rl.close();
}

// ─── HTTP/HTTPS ───
function testHttp(host, port, ssl) {
  const proto = ssl ? 'https' : 'http';
  console.log(`\n${c.c(`🌐 ${proto.toUpperCase()} ${proto}://${host}:${port}/`)}`);
  const start = Date.now();
  const opt = { hostname: host, port, path: '/', method: 'HEAD', timeout: 5000, rejectUnauthorized: false };
  const req = (ssl ? https : http).request(opt, res => {
    result(`${proto.toUpperCase()}`, true, Date.now() - start, `${res.statusCode}`);
  });
  req.on('error', e => result(`${proto.toUpperCase()}`, false, undefined, e.message));
  req.on('timeout', () => { req.destroy(); result(`${proto.toUpperCase()}`, false, undefined, '超时'); });
  req.end();
}

// ─── WebSocket ───
function testWS(host, port) {
  const url = `wss://${host}:${port}`;
  console.log(`\n${c.c(`🔗 WS ${url}`)}`);
  const start = Date.now();
  const ws = new WebSocket(url);
  ws.on('open', () => result('WebSocket', true, Date.now() - start));
  ws.on('error', e => result('WebSocket', false, undefined, e.message));
  ws.on('unexpected-response', () => result('WebSocket', false, Date.now() - start, '非WS协议'));
  setTimeout(() => { ws.close(); result('WebSocket', false, undefined, '超时'); }, 5000);
}

// ─── Java ───
function testJava(host, port) {
  console.log(`\n${c.c(`🔍 Java ${host}:${port}`)}`);
  const start = Date.now();
  const sock = net.createConnection({ host, port, timeout: 4000 });
  sock.on('connect', () => {
    const ms = Date.now() - start;
    sock.write(Buffer.from([0xFE, 0x01]));
    sock.once('data', () => result('Java', true, ms));
    setTimeout(() => result('Java', true, ms), 300);
  });
  sock.on('error', e => result('Java', false, undefined, e.message));
  sock.on('timeout', () => result('Java', false, undefined, '超时'));
}

// ─── Bedrock ───
function testBedrock(host, port) {
  console.log(`\n${c.c(`🔍 Bedrock ${host}:${port}`)}`);
  const start = Date.now();
  const sock = dgram.createSocket('udp4');
  const buf = Buffer.alloc(16, 0); buf[0] = 0x01;
  sock.send(buf, 0, 16, port, host);
  sock.on('message', msg => {
    if (msg[0] === 0x1c) result('Bedrock', true, Date.now() - start);
    else result('Bedrock', false, Date.now() - start, '未知响应');
    sock.close();
  });
  setTimeout(() => { sock.close(); result('Bedrock', false, undefined, '超时'); }, 4000);
}
