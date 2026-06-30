#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const net = require('net');
const { ping } = require('bedrock-protocol');

program
  .option('-h, --host <host>', '目标地址', 'localhost')
  .option('-p, --port <port>', '端口', '25565')
  .parse();

const { host, port } = program.opts();
let javaOk = false, bedOk = false, geyserHint = false;

// Java (TCP) 检测
function checkJava() {
  return new Promise(res => {
    const sock = net.createConnection({ host, port, timeout: 3000 });
    sock.on('connect', () => { javaOk = true; sock.destroy(); res(); });
    sock.on('error', () => res());
    sock.on('timeout', () => { sock.destroy(); res(); });
  });
}

// Bedrock (RakNet) 检测
async function checkBedrock() {
  try {
    const res = await ping({ host, port: Number(port), timeout: 3000 });
    bedOk = true;
    if (res.motd && res.motd.motd && res.motd.motd.includes('Geyser')) {
      geyserHint = true;
    }
  } catch {
    // Bedrock 不可达
  }
}

(async () => {
  console.log(chalk.cyan(`\n🔍 McCrossCheck → ${host}:${port}\n`));
  await checkJava();
  await checkBedrock();

  console.log(`Java (TCP)           : ${javaOk ? chalk.green('✔ ONLINE') : chalk.red('✘ UNREACHABLE')}`);
  console.log(`Bedrock (RakNet)     : ${bedOk ? chalk.green('✔ ONLINE') : chalk.red('✘ UNREACHABLE')}`);
  if (geyserHint) console.log(chalk.yellow('ℹ 检测到 Geyser 特征'));
  console.log('');

  process.exit(javaOk || bedOk ? 0 : 1);
})();