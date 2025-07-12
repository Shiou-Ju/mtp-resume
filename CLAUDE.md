# MTP Resume Project

## Overview
A CLI tool for smart MTP file transfer with resume capability, built to solve OpenMTP's limitations when transferring large amounts of files.

## Architecture
- Monorepo structure using pnpm workspaces
- Core logic separated from UI (CLI/GUI)
- SQLite for transfer state persistence

## Key Technologies
- Node.js with pnpm package manager
- better-sqlite3 for database operations
- commander.js for CLI interface
- cli-progress for progress display
- child_process for calling libmtp tools

## Development Guidelines
- Use async/await for all asynchronous operations
- Follow error-first callback pattern
- Keep TODO and FIXME comments intact
- Prefer functional programming approach where applicable

## File Structure
```
mtp-resume/
├── packages/
│   ├── core/        # Business logic
│   ├── cli/         # CLI interface
│   └── gui/         # Future GUI
└── pnpm-workspace.yaml
```

## MTP Operations
We wrap libmtp command-line tools (mtp-detect, mtp-files, mtp-getfile) using child_process for MTP device access.

## Database Schema
Simple transfer tracking with file_path + file_size as unique identifier for resume capability.

## Development Commands

### Project Initialization
```bash
# Setup pnpm workspace
echo "packages:\n  - 'packages/*'" > pnpm-workspace.yaml

# Create package directories
mkdir -p packages/core/src packages/cli/src

# Initialize core package
cd packages/core && pnpm init
pnpm add better-sqlite3

# Initialize CLI package
cd ../cli && pnpm init
pnpm add commander chalk cli-progress
pnpm add -D @mtp-transfer/core@workspace:*
```

### Development & Testing
```bash
# Install all dependencies
pnpm install

# Build core package
pnpm --filter @mtp-transfer/core build

# Test CLI commands
pnpm --filter @mtp-transfer/cli dev

# Detect MTP device
mtp-transfer detect

# Transfer files
mtp-transfer transfer ~/Pictures/Phone

# Export transfer log
mtp-transfer export transfer-log.csv
```

### Testing MTP Commands
```bash
# Test MTP detection
mtp-detect

# List files on device
mtp-files

# Download specific file
mtp-getfile [file_id] [destination]
```

## Core Modules

### MTPWrapper (packages/core/src/mtp-wrapper.js)
- Wraps libmtp command-line tools
- Handles device detection and file operations
- Parses command output into structured data

### TransferManager (packages/core/src/transfer-manager.js)
- Manages transfer state and resume logic
- Handles batch operations and progress tracking
- Implements retry mechanisms for failed transfers

### TransferDatabase (packages/core/src/database.js)
- SQLite operations for transfer state
- Tracks file path, size, status, and errors
- Provides statistics and export functionality

## Development Workflow

### Starting New Features
```bash
claude
> Implement the pending files comparison logic in file-differ.js
```

### Debugging MTP Issues
```bash
claude
> /project:test-mtp
```

### Code Refactoring
```bash
claude
> Refactor the transfer-manager.js to improve error handling and add retry logic
```

### Documentation Generation
```bash
claude
> Generate JSDoc comments for all exported functions in the core package
```

## Git Commit Guidelines

### Conventional Commits Format
Follow the Conventional Commits specification for all commit messages:

```
<type>: <description>

[optional body with main changes listed]
```

### Commit Types
- **feat**: A new feature or functionality was added
- **fix**: A bug or error was fixed
- **docs**: Changes were made to documentation
- **style**: Changes were made to code style, formatting, indentation, or whitespace
- **refactor**: Code was refactored without changing functionality
- **test**: Changes were made to test code
- **chore**: Changes to build process, configuration files, or non-code aspects

### Commit Message Best Practices
- **Keep messages concise**: Use short, clear descriptions in Traditional Chinese
- **List main changes first**: After the summary line, list important changes for quick understanding
- **Consistent syntax**: Start each change item with a verb (e.g., "新增...", "更新...", "修復...")
- **Use Traditional Chinese**: All commit messages should be in Traditional Chinese, technical terms can remain in English
- **Avoid verbose explanations**: Focus on what changed, not why or how

### Example Commit Messages

**Concise format (preferred):**
```
feat: 新增智慧續傳功能和 SQLite 資料庫支援
fix: 修復大檔案傳輸中斷問題
docs: 更新 README 市場定位說明
chore: 建立 Claude Code 專案配置
```

**Detailed format (for complex changes):**
```
feat: 新增智慧續傳功能和 SQLite 資料庫支援

主要變動：
- 新增傳輸狀態持久化功能
- 實作中斷後續傳能力
- 建立檔案追蹤資料庫架構
- 強化大檔案錯誤處理機制
```

## Best Practices

- Provide clear test cases for Claude to validate against
- Use `/project:` commands for predefined workflows
- Keep CLAUDE.md updated with latest architecture changes
- Save common workflows as command templates in `.claude/commands/`
- Test MTP operations with actual devices when possible
- Handle graceful degradation when MTP tools are unavailable
- Follow Conventional Commits format for all commits
- Always check git status before committing to ensure clean working directory