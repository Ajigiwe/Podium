/**
 * Helper to SSH into the VPS and deploy the public key.
 * Uses the ssh2 library if available, otherwise falls back to basic approach.
 */
import { readFileSync } from 'fs';
import { createConnection } from 'net';
import { spawn } from 'child_process';

const HOST = '161.97.176.191';
const USER = 'root';
const PASS = 'vader12345';
const PUB_KEY = readFileSync(`${process.env.HOME}/.ssh/codebuff_vps.pub`, 'utf8').trim();

// Try ssh-copy-id approach with expect-like behavior
const proc = spawn('ssh-copy-id', [
  '-i', `${process.env.HOME}/.ssh/codebuff_vps.pub`,
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'PubkeyAuthentication=no',
  `${USER}@${HOST}`,
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, SSHPASS: PASS },
});

let stdout = '';
let stderr = '';
let passwordSent = false;

proc.stdout.on('data', (data) => {
  const str = data.toString();
  stdout += str;
  // Look for password prompt
  if ((str.includes('password:') || str.includes('Password:')) && !passwordSent) {
    passwordSent = true;
    proc.stdin.write(PASS + '\n');
  }
});

proc.stderr.on('data', (data) => {
  stderr += data.toString();
});

proc.on('close', (code) => {
  if (code === 0) {
    console.log('✓ Public key deployed to VPS');
  } else {
    console.log('ssh-copy-id exit code:', code);
    console.log('stdout:', stdout.slice(-200));
    console.log('stderr:', stderr.slice(-200));
  }
});

// Timeout after 15s
setTimeout(() => {
  if (!proc.killed) {
    proc.kill();
    console.log('Timed out. stderr:', stderr.slice(-200));
  }
}, 15000);
