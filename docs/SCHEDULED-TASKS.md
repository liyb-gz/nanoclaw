# Scheduled Tasks

How NanoClaw handles recurring and one-time automated tasks.

## Overview

```
Agent (in container) --> IPC file --> Host process --> SQLite --> Scheduler loop --> Container execution
```

Tasks are created by agents via tools, stored in SQLite, and executed by a host-side scheduler loop that spawns containers.

## Creating Tasks

Talk to the assistant:

```
@Andy every Monday at 8am, compile AI news from Hacker News and message me a summary
@Andy send an overview of the sales pipeline every weekday morning at 9am
@Andy remind me to check email in 30 minutes
```

## Managing Tasks

```
@Andy list all scheduled tasks
@Andy pause the Monday briefing task
@Andy resume the news digest task
@Andy cancel task task-1738649123456-abc123
```

## Schedule Types

| Type       | Format        | Example                 | Behavior                      |
| ---------- | ------------- | ----------------------- | ----------------------------- |
| `cron`     | Standard cron | `"0 9 * * *"`           | Daily at 9am (local timezone) |
| `interval` | Milliseconds  | `"300000"`              | Every 5 minutes               |
| `once`     | ISO timestamp | `"2026-02-01T15:30:00"` | One-time execution            |

### Cron Examples

| Expression    | Meaning                          |
| ------------- | -------------------------------- |
| `0 9 * * *`   | Daily at 9:00 AM                 |
| `0 9 * * 1-5` | Weekdays at 9:00 AM              |
| `0 9 * * 1`   | Every Monday at 9:00 AM          |
| `0 */2 * * *` | Every 2 hours                    |
| `30 8 1 * *`  | 8:30 AM on the 1st of each month |

All times use the local timezone configured in `src/config.ts`.

## Context Modes

| Mode       | Description                                     | Use Case                               |
| ---------- | ----------------------------------------------- | -------------------------------------- |
| `group`    | Task runs with the group's conversation session | Tasks that need chat history or memory |
| `isolated` | Task runs in a fresh session                    | Independent tasks, data collection     |

The agent chooses the appropriate mode based on the task. Most tasks use `group` mode by default.

## Task States

| Status      | Meaning                        |
| ----------- | ------------------------------ |
| `active`    | Scheduled to run at `next_run` |
| `paused`    | Skipped until resumed          |
| `completed` | One-time task finished         |

## Authorization

| Operation           | Main Group | Non-Main Groups |
| ------------------- | ---------- | --------------- |
| Schedule for self   | Yes        | Yes             |
| Schedule for others | Yes        | No              |
| View all tasks      | Yes        | Own only        |
| Pause/resume/cancel | All tasks  | Own tasks only  |

The host process validates all task operations against the group's identity.

## Architecture

### Components

| Component      | Location                      | Role                                                                      |
| -------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Agent tools    | `container/tools/nanoclaw.ts` | `schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task` |
| IPC handler    | `src/index.ts`                | Reads IPC files, validates authorization, writes to DB                    |
| Scheduler loop | `src/task-scheduler.ts`       | Polls for due tasks, executes in containers                               |
| Database       | `src/db.ts`                   | `scheduled_tasks` and `task_run_logs` tables                              |

### Task Lifecycle

1. **Creation**: Agent calls `schedule_task` tool, writes JSON to `/workspace/ipc/tasks/`
2. **Processing**: Host reads IPC file, validates authorization, inserts into `scheduled_tasks`
3. **Scheduling**: Loop checks `next_run <= now` every minute
4. **Execution**: Spawns container with group context, runs agent with task prompt
5. **Logging**: Results saved to `task_run_logs`, `next_run` updated

### IPC Flow

```
Container                          Host
   |                                |
   |-- write task IPC file -------->|
   |                                |-- validate authorization
   |                                |-- insert into SQLite
   |                                |
   |                         [scheduler loop]
   |                                |-- query due tasks
   |<-- spawn container ------------|
   |                                |
   |-- execute task prompt          |
   |-- write results/messages ----->|
   |                                |-- log results
   |                                |-- update next_run
```

## Database Schema

```sql
CREATE TABLE scheduled_tasks (
  id TEXT PRIMARY KEY,
  group_folder TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  prompt TEXT NOT NULL,
  schedule_type TEXT NOT NULL,      -- 'cron', 'interval', 'once'
  schedule_value TEXT NOT NULL,
  context_mode TEXT DEFAULT 'isolated',  -- 'group' or 'isolated'
  next_run TEXT,
  last_run TEXT,
  last_result TEXT,
  status TEXT DEFAULT 'active',     -- 'active', 'paused', 'completed'
  created_at TEXT NOT NULL
);

CREATE TABLE task_run_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  run_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL,             -- 'success' or 'error'
  result TEXT,
  error TEXT
);
```

## Agent Tools Reference

### schedule_task

```typescript
schedule_task({
  prompt: 'Check Hacker News and send me AI news',
  schedule_type: 'cron',
  schedule_value: '0 9 * * 1-5', // Weekdays at 9am
  context_mode: 'group', // Has chat history
  target_group: 'main', // Main only: schedule for other groups
});
```

### list_tasks

Returns all tasks visible to the current group.

### pause_task / resume_task / cancel_task

```typescript
pause_task({ task_id: 'task-123...' });
resume_task({ task_id: 'task-123...' });
cancel_task({ task_id: 'task-123...' });
```

## Configuration

In `src/config.ts`:

| Setting                   | Default         | Description                           |
| ------------------------- | --------------- | ------------------------------------- |
| `SCHEDULER_POLL_INTERVAL` | 60000           | How often to check for due tasks (ms) |
| `TIMEZONE`                | System timezone | Timezone for cron expressions         |

## Key Files

| File                          | Purpose                          |
| ----------------------------- | -------------------------------- |
| `container/tools/nanoclaw.ts` | Agent-side task tools            |
| `src/task-scheduler.ts`       | Host-side scheduler loop         |
| `src/index.ts`                | IPC handler for task operations  |
| `src/db.ts`                   | Database operations              |
| `store/messages.db`           | SQLite database with task tables |
