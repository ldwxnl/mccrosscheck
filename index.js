#!/usr/bin/env node
// ============================================================
// McCrossCheck 三合一 · 全汉化版
// 功能：测试 WebSocket / Java / Bedrock 服务器连通性和延迟
// 特色：自动查询 SRV 记录（无需手动输端口）
// ============================================================

const readline = require('readline');
const net = require('net');
const dgram = require('dgram');
const WebSocket = require('ws');
const dns = require('dns'); // Node.js 内置 DNS 模块

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 清屏并显示主菜单
console.clear();
console.log(`
╔══════════════════════════════════╗
║       McCrossCheck 三合一        ║
╠══════════════════════════════════╣
║  1. WebSocket (wss://)           ║
║  2. Java 版 (TCP)               ║
║  3. 基岩版 (UDP)                ║
╚══════════════════════════════════╝
`);

// ─── 第一步：选择模式 ───
rl.question('请选择 (1/2/3): ', choice => {
  const mode = choice.trim();

  // 各模式的默认端口
  const defaultPorts = { '1': 443, '2': 25565, '3': 19132 };
  const defaultPort = defaultPorts[mode] || 25565;

  // ─── 第二步：输入目标地址 ───
  rl.question('目标地址 (IP或域名): ', host => {

    // ─── 第三步：输入端口（可回车跳过） ───
    rl.question(`端口 (默认 ${defaultPort}，回车自动查询SRV): `, portInput => {

      // 如果用户直接回车，尝试查询 SRV 记录
      if (portInput.trim() === '') {
        lookupSRV(host, mode, (srvHost, srvPort) => {
          // SRV 查询回调：可能查到新地址+端口，也可能查不到
          const finalHost = srvHost || host;
          const finalPort = srvPort || defaultPort;
          console.log(`📡 使用地址: ${finalHost}:${finalPort}`);
          startTest(mode, finalHost, finalPort);
        });
      } else {
        // 用户手动输入了端口，直接用
        const port = parseInt(portInput) || defaultPort;
        startTest(mode, host, port);
      }
    });
  });
});

// ============================================================
// SRV 记录查询函数
// Minecraft Java 版用 _minecraft._tcp.域名 查询
// 基岩版用 _minecraft._udp.域名 查询
// WebSocket 没有标准 SRV，直接返回原地址
// ============================================================
function lookupSRV(host, mode, callback) {
  // WebSocket 模式没有标准 SRV 记录，直接跳过
  if (mode === '1') {
    return callback(null, null);
  }

  // 构造 SRV 查询名
  // Java 版: _minecraft._tcp.example.com
  // 基岩版: _minecraft._udp.example.com
  const proto = mode === '2' ? '_tcp' : '_udp';
  const srvName = `_minecraft.${proto}.${host}`;

  console.log(`🔎 正在查询 SRV 记录: ${srvName}`);

  dns.resolveSrv(srvName, (err, addresses) => {
    if (err || !addresses || addresses.length === 0) {
      // 查不到 SRV 记录，返回原地址，用默认端口
      console.log('ℹ️  未找到 SRV 记录，使用默认端口');
      return callback(null, null);
    }

    // 取第一条 SRV 记录
    const srv = addresses[0];
    console.log(`✅ 找到 SRV 记录: ${srv.name}:${srv.port}`);
    return callback(srv.name, srv.port);
  });
}

// ============================================================
// 根据模式启动对应的测试函数
// ============================================================
function startTest(mode, host, port) {
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
}

// ============================================================
// WebSocket 测试函数
// 连接 wss://host:port 并测量延迟
// ============================================================
function testWebSocket(host, port) {
  const url = `wss://${host}:${port}`;
  console.log(`\n🔗 正在连接 WebSocket: ${url}`);
  const start = Date.now();
  const ws = new WebSocket(url);

  // 连接成功
  ws.on('open', () => {
    const latency = Date.now() - start;
    console.log(`✅ WebSocket 连接成功`);
    console.log(`⏱ 延迟: ${latency} 毫秒`);
    ws.close();
    rl.close();
  });

  // 连接失败（如连接被拒绝、超时等）
  ws.on('error', err => {
    console.log(`❌ 连接失败: ${err.message}`);
    rl.close();
  });

  // 服务器响应了 HTTP 但不是 WebSocket 协议
  ws.on('unexpected-response', () => {
    const latency = Date.now() - start;
    console.log(`⚠️  服务器响应了但非 WebSocket 协议 (延迟 ${latency} 毫秒)`);
    rl.close();
  });

  // 5 秒超时
  setTimeout(() => {
    console.log('⏰ 超时 (5 秒)');
    ws.close();
    rl.close();
  }, 5000);
}

// ============================================================
// Java 版 (TCP) 测试函数
// 建立 TCP 连接并测量延迟
// ============================================================
function testJava(host, port) {
  console.log(`\n🔍 测试 Java 版 (TCP): ${host}:${port}`);
  const start = Date.now();
  const sock = net.createConnection({ host, port, timeout: 4000 });

  // 连接成功
  sock.on('connect', () => {
    const latency = Date.now() - start;
    console.log(`✅ TCP 连接成功`);
    console.log(`⏱ 延迟: ${latency} 毫秒`);
    sock.destroy();
    rl.close();
  });

  // 连接失败
  sock.on('error', err => {
    console.log(`❌ 连接失败: ${err.message}`);
    rl.close();
  });

  // 4 秒超时
  sock.on('timeout', () => {
    console.log('⏰ 超时 (4 秒)');
    sock.destroy();
    rl.close();
  });
}

// ============================================================
// 基岩版 (UDP/RakNet) 测试函数
// 发送 RakNet Unconnected Ping 包并等待 Pong 响应
// ============================================================
function testBedrock(host, port) {
  console.log(`\n🔍 测试基岩版 (RakNet UDP): ${host}:${port}`);
  const start = Date.now();
  const socket = dgram.createSocket('udp4');

  // RakNet Unconnected Ping 数据包（固定格式）
  const buf = Buffer.from([
    0x01,                         // 数据包 ID: Unconnected Ping
    0x00, 0x00, 0x00, 0x00,       // Ping ID（随便填）
    0x00, 0x00, 0x00, 0x00,       // 客户端 GUID（随便填）
    0x00, 0x00, 0x00, 0x00,       // 时间戳（随便填）
    0x00, 0x00, 0x00, 0x00        // 预留
  ]);

  // 发送 UDP 数据包
  socket.send(buf, 0, buf.length, port, host, err => {
    if (err) {
      console.log(`❌ 发送失败: ${err.message}`);
      socket.close();
      rl.close();
    }
  });

  // 收到响应
  socket.on('message', msg => {
    const latency = Date.now() - start;

    // 0x1c = Unconnected Pong 响应包
    if (msg[0] === 0x1c) {
      console.log(`✅ 基岩版服务器响应`);
      console.log(`⏱ 延迟: ${latency} 毫秒`);
    } else {
      console.log(`⚠️  收到未知响应 (延迟 ${latency} 毫秒)`);
    }
    socket.close();
    rl.close();
  });

  // 4 秒超时
  setTimeout(() => {
    console.log('⏰ 超时 (4 秒)');
    socket.close();
    rl.close();
  }, 4000);
}
