/**
 * Upload feed/pleso-therapists.jsonl.gz to the OpenAI product feed SFTP.
 * The file name is stable, so every run replaces the previous snapshot.
 *
 *   npm run feed:upload
 *
 * Reads OPENAI_FEED_SFTP_{HOST,PORT,USER,PASSWORD,PATH} from the environment
 * (or from .env, which is gitignored).
 */
import { existsSync, statSync } from 'node:fs';
import SftpClient from 'ssh2-sftp-client';

if (existsSync('.env')) process.loadEnvFile('.env');

const FILE = process.env.FEED_FILE ?? 'feed/pleso-therapists.jsonl.gz';
const env = (k: string): string => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k}. Set it in .env (see .env.example).`);
    process.exit(1);
  }
  return v;
};

const host = env('OPENAI_FEED_SFTP_HOST');
const username = env('OPENAI_FEED_SFTP_USER');
const password = env('OPENAI_FEED_SFTP_PASSWORD');
const port = Number(process.env.OPENAI_FEED_SFTP_PORT ?? 443);
const dir = (process.env.OPENAI_FEED_SFTP_PATH ?? '/').replace(/\/?$/, '/');
if (!existsSync(FILE)) {
  console.error(`${FILE} not found. Run "npm run feed:build" first.`);
  process.exit(1);
}

const remote = `${dir}${FILE.split('/').pop()}`;
const sftp = new SftpClient();
try {
  await sftp.connect({ host, port, username, password, readyTimeout: 30_000 });
  await sftp.put(FILE, remote);
  const stat = await sftp.stat(remote);
  console.log(`Uploaded ${FILE} (${statSync(FILE).size} bytes) → sftp://${host}:${port}${remote} (remote size ${stat.size})`);
} finally {
  await sftp.end();
}
