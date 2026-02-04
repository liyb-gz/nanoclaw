# Adding Folder Access

How to give NanoClaw agents access to directories on your machine.

## Overview

NanoClaw has a fully-implemented folder access system. You configure it in two places:

1. **Mount Allowlist** (`~/.config/nanoclaw/mount-allowlist.json`) - Security config: which folders CAN be mounted
2. **Group Configuration** (`data/registered_groups.json`) - Per-group config: which folders ARE mounted

The allowlist is stored outside the project and never mounted into containers, making it tamper-proof from agents.

## Step 1: Create the Mount Allowlist

```bash
mkdir -p ~/.config/nanoclaw
```

Create `~/.config/nanoclaw/mount-allowlist.json`:

```json
{
  "allowedRoots": [
    {
      "path": "~/projects",
      "allowReadWrite": true,
      "description": "Development projects"
    },
    {
      "path": "~/Documents/Obsidian",
      "allowReadWrite": true,
      "description": "Obsidian vault"
    },
    {
      "path": "~/Downloads",
      "allowReadWrite": false,
      "description": "Downloads folder (read-only)"
    }
  ],
  "blockedPatterns": ["password", "secret", "token"],
  "nonMainReadOnly": true
}
```

An example template is available at `config-examples/mount-allowlist.json`.

### Allowlist Fields

| Field                           | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `allowedRoots`                  | Directories that can be mounted                          |
| `allowedRoots[].path`           | Directory path (supports `~` for home)                   |
| `allowedRoots[].allowReadWrite` | Whether read-write access is permitted                   |
| `allowedRoots[].description`    | Optional documentation                                   |
| `blockedPatterns`               | Patterns that reject mounts (e.g., "secret", "password") |
| `nonMainReadOnly`               | If true, non-main groups always get read-only access     |

### Default Blocked Patterns

These patterns are always blocked regardless of your config:

```
.ssh, .gnupg, .gpg, .aws, .azure, .gcloud, .kube, .docker,
credentials, .env, .netrc, .npmrc, .pypirc, id_rsa, id_ed25519,
private_key, .secret
```

## Step 2: Configure Groups

Edit `data/registered_groups.json` to add mounts for specific groups:

```json
{
  "120363336345536173@g.us": {
    "name": "Family Chat",
    "folder": "family-chat",
    "trigger": "@Andy",
    "added_at": "2026-01-31T12:00:00Z",
    "containerConfig": {
      "additionalMounts": [
        {
          "hostPath": "~/projects/webapp",
          "containerPath": "webapp",
          "readonly": false
        },
        {
          "hostPath": "~/Documents/Obsidian",
          "containerPath": "obsidian",
          "readonly": true
        }
      ]
    }
  }
}
```

### Mount Fields

| Field           | Purpose                                     |
| --------------- | ------------------------------------------- |
| `hostPath`      | Path on your machine (supports `~`)         |
| `containerPath` | Name inside container (no slashes, no `..`) |
| `readonly`      | Whether to mount read-only (default: true)  |

## How Mounts Appear in Container

| Host Path              | Container Path              |
| ---------------------- | --------------------------- |
| `~/projects/webapp`    | `/workspace/extra/webapp`   |
| `~/Documents/Obsidian` | `/workspace/extra/obsidian` |

All additional mounts appear under `/workspace/extra/`.

## Example Usage

After setup:

```
@Andy review the code in the webapp folder and suggest improvements
@Andy search my Obsidian vault for notes about project planning
@Andy list all TypeScript files in the webapp project
```

## Validation Rules

A mount is **rejected** if:

- Host path doesn't exist
- Host path contains a blocked pattern
- Host path is not under an allowed root
- Container path contains `..` or is absolute
- Container path is empty

A mount is **forced read-only** if:

- `readonly: true` in the mount config
- Root has `allowReadWrite: false`
- Non-main group and `nonMainReadOnly: true`

## Security Notes

1. **Allowlist is tamper-proof**: Stored at `~/.config/nanoclaw/`, never mounted into containers
2. **Symlinks resolved**: Path traversal via symlinks is prevented
3. **Non-main isolation**: Use `nonMainReadOnly: true` to ensure non-main groups can only read
4. **Blocked patterns**: Credentials and sensitive directories are automatically blocked
5. **Restart required**: Changes to the allowlist require restarting NanoClaw (cached in memory)

## Quick Reference

| File                                      | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `~/.config/nanoclaw/mount-allowlist.json` | Security allowlist (edit to allow folders) |
| `data/registered_groups.json`             | Per-group mounts (edit to add mounts)      |
| `config-examples/mount-allowlist.json`    | Example template                           |
| `src/mount-security.ts`                   | Validation logic                           |
| `src/container-runner.ts`                 | Mount building logic                       |

See [SECURITY.md](SECURITY.md) for the full security model.
