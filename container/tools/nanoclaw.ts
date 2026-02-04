import { tool } from '@opencode-ai/plugin';
import fs from 'fs';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';

const IPC_DIR = '/workspace/ipc';
const MESSAGES_DIR = path.join(IPC_DIR, 'messages');
const TASKS_DIR = path.join(IPC_DIR, 'tasks');

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);
  return filename;
}

function getContext(): {
  chatJid: string;
  groupFolder: string;
  isMain: boolean;
} {
  const contextFile = path.join(IPC_DIR, 'context.json');
  if (fs.existsSync(contextFile)) {
    return JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
  }
  return { chatJid: '', groupFolder: '', isMain: false };
}

export const send_message = tool({
  description:
    'Send a message to the current WhatsApp group. Use this to proactively share information or updates.',
  args: {
    text: tool.schema.string().describe('The message text to send'),
  },
  async execute(args) {
    const ctx = getContext();
    const data = {
      type: 'message',
      chatJid: ctx.chatJid,
      text: args.text,
      groupFolder: ctx.groupFolder,
      timestamp: new Date().toISOString(),
    };
    const filename = writeIpcFile(MESSAGES_DIR, data);
    return `Message queued for delivery (${filename})`;
  },
});

export const schedule_task = tool({
  description: `Schedule a recurring or one-time task. The task will run as a full agent with access to all tools.

CONTEXT MODE - Choose based on task type:
• "group" (recommended for most tasks): Task runs in the group's conversation context, with access to chat history and memory.
• "isolated": Task runs in a fresh session with no conversation history.

SCHEDULE VALUE FORMAT (all times are LOCAL timezone):
• cron: Standard cron expression (e.g., "0 9 * * *" for daily at 9am LOCAL time)
• interval: Milliseconds between runs (e.g., "300000" for 5 minutes)
• once: Local time WITHOUT "Z" suffix (e.g., "2026-02-01T15:30:00")`,
  args: {
    prompt: tool.schema
      .string()
      .describe('What the agent should do when the task runs'),
    schedule_type: tool.schema
      .enum(['cron', 'interval', 'once'])
      .describe(
        'cron=recurring at specific times, interval=recurring every N ms, once=run once',
      ),
    schedule_value: tool.schema
      .string()
      .describe(
        'cron: "0 9 * * *" | interval: milliseconds | once: local timestamp',
      ),
    context_mode: tool.schema
      .enum(['group', 'isolated'])
      .default('group')
      .describe('group=runs with chat history, isolated=fresh session'),
    target_group: tool.schema
      .string()
      .optional()
      .describe('Target group folder (main only, defaults to current group)'),
  },
  async execute(args) {
    const ctx = getContext();

    if (args.schedule_type === 'cron') {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return `Invalid cron: "${args.schedule_value}". Use format like "0 9 * * *" (daily 9am).`;
      }
    } else if (args.schedule_type === 'interval') {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return `Invalid interval: "${args.schedule_value}". Must be positive milliseconds.`;
      }
    } else if (args.schedule_type === 'once') {
      const date = new Date(args.schedule_value);
      if (isNaN(date.getTime())) {
        return `Invalid timestamp: "${args.schedule_value}". Use ISO 8601 format.`;
      }
    }

    const targetGroup =
      ctx.isMain && args.target_group ? args.target_group : ctx.groupFolder;
    const data = {
      type: 'schedule_task',
      prompt: args.prompt,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode || 'group',
      groupFolder: targetGroup,
      chatJid: ctx.chatJid,
      createdBy: ctx.groupFolder,
      timestamp: new Date().toISOString(),
    };

    const filename = writeIpcFile(TASKS_DIR, data);
    return `Task scheduled (${filename}): ${args.schedule_type} - ${args.schedule_value}`;
  },
});

export const list_tasks = tool({
  description:
    "List all scheduled tasks. From main: shows all tasks. From other groups: shows only that group's tasks.",
  args: {},
  async execute() {
    const ctx = getContext();
    const tasksFile = path.join(IPC_DIR, 'current_tasks.json');

    if (!fs.existsSync(tasksFile)) {
      return 'No scheduled tasks found.';
    }

    const allTasks = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
    const tasks = ctx.isMain
      ? allTasks
      : allTasks.filter(
          (t: { groupFolder: string }) => t.groupFolder === ctx.groupFolder,
        );

    if (tasks.length === 0) {
      return 'No scheduled tasks found.';
    }

    const formatted = tasks
      .map(
        (t: {
          id: string;
          prompt: string;
          schedule_type: string;
          schedule_value: string;
          status: string;
          next_run: string;
        }) =>
          `- [${t.id}] ${t.prompt.slice(0, 50)}... (${t.schedule_type}: ${t.schedule_value}) - ${t.status}, next: ${t.next_run || 'N/A'}`,
      )
      .join('\n');

    return `Scheduled tasks:\n${formatted}`;
  },
});

export const pause_task = tool({
  description: 'Pause a scheduled task. It will not run until resumed.',
  args: {
    task_id: tool.schema.string().describe('The task ID to pause'),
  },
  async execute(args) {
    const ctx = getContext();
    const data = {
      type: 'pause_task',
      taskId: args.task_id,
      groupFolder: ctx.groupFolder,
      isMain: ctx.isMain,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(TASKS_DIR, data);
    return `Task ${args.task_id} pause requested.`;
  },
});

export const resume_task = tool({
  description: 'Resume a paused task.',
  args: {
    task_id: tool.schema.string().describe('The task ID to resume'),
  },
  async execute(args) {
    const ctx = getContext();
    const data = {
      type: 'resume_task',
      taskId: args.task_id,
      groupFolder: ctx.groupFolder,
      isMain: ctx.isMain,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(TASKS_DIR, data);
    return `Task ${args.task_id} resume requested.`;
  },
});

export const cancel_task = tool({
  description: 'Cancel and delete a scheduled task.',
  args: {
    task_id: tool.schema.string().describe('The task ID to cancel'),
  },
  async execute(args) {
    const ctx = getContext();
    const data = {
      type: 'cancel_task',
      taskId: args.task_id,
      groupFolder: ctx.groupFolder,
      isMain: ctx.isMain,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(TASKS_DIR, data);
    return `Task ${args.task_id} cancellation requested.`;
  },
});

export const register_group = tool({
  description: `Register a new WhatsApp group so the agent can respond to messages there. Main group only.
Use available_groups.json to find the JID for a group.`,
  args: {
    jid: tool.schema
      .string()
      .describe('The WhatsApp JID (e.g., "120363336345536173@g.us")'),
    name: tool.schema.string().describe('Display name for the group'),
    folder: tool.schema
      .string()
      .describe('Folder name for group files (lowercase, hyphens)'),
    trigger: tool.schema.string().describe('Trigger word (e.g., "@Andy")'),
  },
  async execute(args) {
    const ctx = getContext();
    if (!ctx.isMain) {
      return 'Only the main group can register new groups.';
    }

    const data = {
      type: 'register_group',
      jid: args.jid,
      name: args.name,
      folder: args.folder,
      trigger: args.trigger,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);
    return `Group "${args.name}" registered. It will start receiving messages immediately.`;
  },
});
