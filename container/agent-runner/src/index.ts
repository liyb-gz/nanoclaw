import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
}

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function writeContextFile(input: ContainerInput): void {
  const ipcDir = '/workspace/ipc';
  fs.mkdirSync(ipcDir, { recursive: true });
  const contextFile = path.join(ipcDir, 'context.json');
  fs.writeFileSync(
    contextFile,
    JSON.stringify(
      {
        chatJid: input.chatJid,
        groupFolder: input.groupFolder,
        isMain: input.isMain,
      },
      null,
      2,
    ),
  );
}

async function runOpenCode(
  prompt: string,
  sessionId?: string,
): Promise<{ output: string; newSessionId?: string }> {
  return new Promise((resolve, reject) => {
    const args = ['run'];

    if (sessionId) {
      args.push('--session', sessionId);
    }

    args.push('--format', 'json');
    args.push(prompt);

    log(`Running: opencode ${args.join(' ')}`);

    const proc = spawn('opencode', args, {
      cwd: '/workspace/group',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: '/home/node',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      log(chunk.trim());
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(`OpenCode exited with code ${code}: ${stderr.slice(-500)}`),
        );
        return;
      }

      try {
        const lines = stdout.trim().split('\n');
        let output = '';
        let newSessionId: string | undefined;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'text' && event.text) {
              output += event.text;
            }
            if (event.session_id) {
              newSessionId = event.session_id;
            }
          } catch {
            output += line;
          }
        }

        resolve({ output, newSessionId });
      } catch (err) {
        resolve({ output: stdout });
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main(): Promise<void> {
  let input: ContainerInput;

  try {
    const stdinData = await readStdin();
    input = JSON.parse(stdinData);
    log(`Received input for group: ${input.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  writeContextFile(input);

  let prompt = input.prompt;
  if (input.isScheduledTask) {
    prompt = `[SCHEDULED TASK - You are running automatically, not in response to a user message. Use nanoclaw_send_message if needed to communicate with the user.]\n\n${input.prompt}`;
  }

  try {
    log('Starting OpenCode agent...');

    const { output, newSessionId } = await runOpenCode(prompt, input.sessionId);

    log('Agent completed successfully');
    writeOutput({
      status: 'success',
      result: output,
      newSessionId: newSessionId || input.sessionId,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      error: errorMessage,
    });
    process.exit(1);
  }
}

main();
