<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  My personal AI assistant that runs securely in containers. Lightweight and built to be understood and customized for your own needs.
</p>

## Why I Built This

[OpenClaw](https://github.com/openclaw/openclaw) is an impressive project with a great vision. But I can't sleep well running software I don't understand with access to my life. OpenClaw has 52+ modules, 8 config management files, 45+ dependencies, and abstractions for 15 channel providers. Security is application-level (allowlists, pairing codes) rather than OS isolation. Everything runs in one Node process with shared memory.

NanoClaw gives you the same core functionality in a codebase you can understand in 8 minutes. One process. A handful of files. Agents run in actual Linux containers with filesystem isolation, not behind permission checks.

## Quick Start

```bash
git clone https://github.com/liyb-gz/nanoclaw.git
cd nanoclaw
opencode
```

Then run `/setup`. OpenCode handles everything: dependencies, authentication, Docker container setup, service configuration.

## Philosophy

**Small enough to understand.** One process, a few source files. No microservices, no message queues, no abstraction layers. Have OpenCode walk you through it.

**Secure by isolation.** Agents run in Docker containers. They can only see what's explicitly mounted. Bash access is safe because commands run inside the container, not on your host.

**Built for one user.** This isn't a framework. It's working software that fits my exact needs. You fork it and have OpenCode make it match your exact needs.

**Customization = code changes.** No configuration sprawl. Want different behavior? Modify the code. The codebase is small enough that this is safe.

**AI-native.** No installation wizard; OpenCode guides setup. No monitoring dashboard; ask the agent what's happening. No debugging tools; describe the problem, the agent fixes it.

**Skills over features.** Contributors shouldn't add features (e.g. support for Telegram) to the codebase. Instead, they contribute [opencode skills](https://opencode.ai/docs/skills) like `/add-telegram` that transform your fork. You end up with clean code that does exactly what you need.

**Best harness, best model.** This runs on the OpenCode SDK, which means you're running OpenCode directly. The harness matters. A bad harness makes even smart models seem dumb, a good harness gives them superpowers. OpenCode is (IMO) the best harness available.

## What It Supports

- **WhatsApp I/O** - Message your AI assistant from your phone
- **Isolated group context** - Each group has its own `AGENTS.md` memory, isolated filesystem, and runs in its own container sandbox with only that filesystem mounted
- **Main channel** - Your private channel (self-chat) for admin control; every other group is completely isolated
- **Scheduled tasks** - Recurring jobs that run the agent and can message you back
- **Web access** - Search and fetch content
- **Container isolation** - Agents sandboxed in Docker containers
- **Optional integrations** - Add Gmail (`/add-gmail`) and more via skills

## Usage

Talk to your assistant with the trigger word (default: `@Mira`):

```
@Mira send an overview of the sales pipeline every weekday morning at 9am (has access to my Obsidian vault folder)
@Mira review the git history for the past week each Friday and update the README if there's drift
@Mira every Monday at 8am, compile news on AI developments from Hacker News and TechCrunch and message me a briefing
```

From the main channel (your self-chat), you can manage groups and tasks:

```
@Mira list all scheduled tasks across groups
@Mira pause the Monday briefing task
@Mira join the Family Chat group
```

## Customizing

There are no configuration files to learn. Just tell OpenCode what you want:

- "Change the trigger word to @Bob"
- "Remember in the future to make responses shorter and more direct"
- "Add a custom greeting when I say good morning"
- "Store conversation summaries weekly"

Or run `/customize` for guided changes.

The codebase is small enough that the agent can safely modify it.

## Contributing

**Don't add features. Add skills.**

If you want to add Telegram support, don't create a PR that adds Telegram alongside WhatsApp. Instead, contribute a skill file (`.opencode/skills/add-telegram/SKILL.md`) that teaches OpenCode how to transform a NanoClaw installation to use Telegram.

Users then run `/add-telegram` on their fork and get clean code that does exactly what they need, not a bloated system trying to support every use case.

### RFS (Request for Skills)

Skills we'd love to see:

**Communication Channels**

- `/add-telegram` - Add Telegram as channel. Should give the user option to replace WhatsApp or add as additional channel. Also should be possible to add it as a control channel (where it can trigger actions) or just a channel that can be used in actions triggered elsewhere
- `/add-slack` - Add Slack
- `/add-discord` - Add Discord

**Platform Support**

- `/setup-windows` - Windows via WSL2 + Docker

**Session Management**

- `/add-clear` - Add a `/clear` command that compacts the conversation (summarizes context while preserving critical information in the same session). Requires figuring out how to trigger compaction programmatically via the OpenCode SDK.

## Requirements

- macOS or Linux
- Node.js 20+
- [OpenCode](https://opencode.ai)
- [Docker](https://docker.com/products/docker-desktop)

## Architecture

```
WhatsApp (baileys) --> SQLite --> Polling loop --> Docker Container (OpenCode CLI) --> Response
```

Single Node.js process. Agents execute in isolated Docker containers with mounted directories. IPC via filesystem. No daemons, no queues, no complexity.

Key files:

- `src/index.ts` - Main app: WhatsApp connection, routing, IPC
- `src/container-runner.ts` - Spawns agent containers
- `src/task-scheduler.ts` - Runs scheduled tasks
- `src/db.ts` - SQLite operations
- `groups/*/AGENTS.md` - Per-group memory

## FAQ

**Why WhatsApp and not Telegram/Signal/etc?**

Because I use WhatsApp. Fork it and run a skill to change it. That's the whole point.

**Can I run this on Linux?**

Yes. Docker works on both macOS and Linux.

**Is this secure?**

Agents run in containers, not behind application-level permission checks. They can only access explicitly mounted directories. You should still review what you're running, but the codebase is small enough that you actually can. See [docs/SECURITY.md](docs/SECURITY.md) for the full security model.

**Why no configuration files?**

We don't want configuration sprawl. Every user should customize it to so that the code matches exactly what they want rather than configuring a generic system. If you like having config files, tell the agent to add them.

**How do I debug issues?**

Ask OpenCode. "Why isn't the scheduler running?" "What's in the recent logs?" "Why did this message not get a response?" That's the AI-native approach.

**Why isn't the setup working for me?**

I don't know. Run `opencode`, then run `/debug`. If OpenCode finds an issue that is likely affecting other users, open a PR to modify the setup SKILL.md.

**What changes will be accepted into the codebase?**

Security fixes, bug fixes, and clear improvements to the base configuration. That's it.

Everything else (new capabilities, OS compatibility, hardware support, enhancements) should be contributed as skills.

This keeps the base system minimal and lets every user customize their installation without inheriting features they don't want.

## License

MIT
