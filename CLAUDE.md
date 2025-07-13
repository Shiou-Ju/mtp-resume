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

## Development Workflow with Testing

### Phase-by-Phase Development
Each development phase should include comprehensive testing before moving to the next phase:

#### Phase 1: Foundation Testing
```bash
# After implementing monorepo structure
pnpm install                    # Verify workspace setup
pnpm --filter @mtp-transfer/core build  # Test core package build
pnpm --filter @mtp-transfer/cli dev     # Test CLI package setup

# Database module testing
node -e "const db = require('./packages/core/src/database.js'); console.log('Database module loads correctly')"
```

#### Phase 2: Core Functionality Testing
```bash
# MTP operations testing (requires real device or mock)
node -e "const MTP = require('./packages/core/src/mtp-wrapper.js'); console.log('MTP wrapper loads correctly')"

# File comparison testing
node -e "const differ = require('./packages/core/src/file-differ.js'); console.log('File differ loads correctly')"

# Integration testing
node -e "const manager = require('./packages/core/src/transfer-manager.js'); console.log('Transfer manager loads correctly')"
```

#### Phase 3: CLI Testing
```bash
# Command execution testing
./packages/cli/src/index.js --help
./packages/cli/src/index.js detect --dry-run
./packages/cli/src/index.js transfer --help

# Progress display testing
./packages/cli/src/index.js transfer /tmp/test --mock-mode
```

#### Phase 4: End-to-End Testing
```bash
# Full workflow testing
pnpm test                       # Run all unit tests
pnpm test:integration          # Run integration tests
pnpm build                     # Verify build process
./packages/cli/src/index.js doctor  # System diagnostic
```

### Testing Guidelines for Each Issue

#### Issue Validation Checklist
Before marking any issue as complete:

1. **Code Quality**
   - [ ] All functions have proper error handling
   - [ ] Code follows project style guidelines
   - [ ] JSDoc comments for public APIs

2. **Functionality Testing**
   - [ ] Unit tests written and passing
   - [ ] Integration points tested
   - [ ] Error scenarios covered

3. **CLI Testing** (for CLI-related issues)
   - [ ] Help text displays correctly
   - [ ] Commands accept expected parameters
   - [ ] Error messages are user-friendly

4. **Database Testing** (for database-related issues)
   - [ ] Schema creation works
   - [ ] CRUD operations function correctly
   - [ ] Data persistence verified

5. **Integration Testing**
   - [ ] Module imports work correctly
   - [ ] Dependencies resolve properly
   - [ ] No circular dependencies

### PR Testing Requirements

Before creating a PR for each issue:

```bash
# Standard pre-PR checklist
git status                     # Ensure clean working directory
pnpm install                   # Verify dependencies
pnpm lint                      # Code style check
pnpm test                      # Run test suite
pnpm build                     # Verify build process

# Issue-specific testing (run the commands from the phase testing above)
```

### Mock Testing Strategy

For testing without real MTP devices:

```bash
# Create mock MTP responses
export MTP_MOCK_MODE=true

# Test with mock data
./packages/cli/src/index.js detect
./packages/cli/src/index.js transfer /tmp/mock-dest --dry-run
```

## Security Guidelines

### Docker Development Environment
This project uses Docker for safe development and testing:

```bash
# Safe commands - isolated in containers
./scripts/dev-docker.sh test     # Syntax checks in container
./scripts/dev-docker.sh build    # Build development image
./scripts/dev-docker.sh install  # Install dependencies safely
./scripts/dev-docker.sh shell    # Interactive development
./scripts/dev-docker.sh status   # Show container status
```

### Security Restrictions
**CRITICAL**: The following commands are PROHIBITED for security:
- ❌ `docker rm` / `docker rmi` - No deletion of containers/images
- ❌ `rm -rf` / `rmdir` - No file system deletion
- ❌ `docker system prune` - No system cleanup
- ❌ `sudo` commands - No privilege escalation
- ❌ `--rm` flags - No auto-removal containers

### Git Operations Restrictions
**DANGEROUS Git operations are PROHIBITED**:

🔴 **High Risk (Permanent Data Loss)**:
- ❌ `git reset --hard` - Permanently deletes uncommitted changes
- ❌ `git push --force` / `git push -f` - Overwrites remote history
- ❌ `git rebase -i` - Rewrites commit history
- ❌ `git branch -D` - Force deletes branches
- ❌ `git clean -fd` - Permanently deletes untracked files
- ❌ `git reflog expire` - Clears recovery history

🟡 **Medium Risk (Requires Confirmation)**:
- ❌ `git reset HEAD~1` - Reverts commits
- ❌ `git revert` - Undoes commits
- ❌ `git merge --no-ff` - Complex merge operations
- ❌ `git stash drop` - Permanently deletes stash

✅ **Safe Git operations remain allowed**:
- `git add`, `git commit`, `git status`, `git push` (normal)
- `git checkout`, `git branch`, `git log`, `git diff`
- All other standard git operations

### Git Worktree Security Guidelines
**Git Worktree operations are classified by risk level**:

🔴 **High Risk (PROHIBITED)**:
- ❌ `git worktree remove --force` - Force removes worktree, ignoring uncommitted changes
- ❌ `git worktree prune --expire=now` - Immediately cleans all worktrees without safety checks
- ❌ Any worktree command with `--force` or `-f` flags

🟡 **Medium Risk (Requires User Confirmation)**:
- ⚠️ `git worktree remove` - Removes worktree directory (may contain uncommitted work)
- ⚠️ `git worktree move` - Moves worktree location (can break IDE configurations)
- ⚠️ `git worktree prune` - Cleans up stale worktree references

✅ **Safe Worktree Operations**:
- `git worktree list` - Lists all worktrees and their status
- `git worktree add` - Creates new worktree for parallel development
- `git worktree repair` - Repairs corrupted worktree references

**Worktree Best Practices**:
- Always check `git worktree list` before removing worktrees
- Ensure all important work is committed before worktree removal
- Use `git status` in each worktree to verify clean state
- Keep worktree directories organized and clearly named

### GitHub Operations Restrictions
**IMPORTANT**: Issue and PR closure require explicit user approval:
- ❌ `gh issue close` - **PROHIBITED** - Issues must be closed manually by user
- ❌ `gh pr close` - **PROHIBITED** - PRs must be closed manually by user  
- ❌ `gh pr merge` - **PROHIBITED** - PRs must be merged manually by user
- ✅ `gh issue create` / `gh issue edit` - Allowed for creating and updating
- ✅ `gh pr create` / `gh pr view` - Allowed for creating and viewing PRs
- ✅ `gh issue comment` - Allowed for adding comments and updates

**Rationale**: 
- Prevents accidental closure of important issues
- Ensures user maintains control over project state
- Provides clear audit trail for all closures
- Allows for manual review before final actions

### Security Confirmation Policy
**When in doubt about security implications:**
1. **ALWAYS ask user for explicit confirmation** before:
   - Installing new npm packages with native components
   - Running commands that could affect the host system
   - Executing unfamiliar system commands
   - Making network requests to external services
   - **Closing Issues or PRs** - Always inform user and ask for manual action

2. **Provide clear risk assessment:**
   - What the command does
   - What system resources it accesses
   - Potential security implications
   - Recommended safer alternatives

3. **Use Docker isolation when possible:**
   - Prefer container-based testing over host execution
   - Use read-only mounts when appropriate
   - Test with mock data instead of real devices

### Example Security Check
```bash
# Before running this command, ask user:
# "This will install better-sqlite3 (native module) - confirm? (y/n)"
pnpm install better-sqlite3
```

### GitHub Operations Workflow
When issues or PRs are ready for closure:

```bash
# Claude will provide completion summary and ask user:
# "Issue #2 is complete. Please manually close with: gh issue close 2"
# "PR #1 is ready for merge. Please manually merge with: gh pr merge 1"

# User executes manually:
gh issue close 2
gh pr merge 1
```

## Best Practices

- **Test each phase thoroughly before proceeding**: Don't move to next phase until current phase tests pass
- **Write tests alongside code**: Each feature should include its tests
- **Use mock data for CI/CD**: Ensure tests can run without real MTP devices
- **Validate CLI usability**: Test commands with actual user scenarios
- **Security first**: Use Docker containers for all testing and development
- **Ask for confirmation**: When security implications are unclear, always ask user
- Provide clear test cases for Claude to validate against
- Use `/project:` commands for predefined workflows
- Keep CLAUDE.md updated with latest architecture changes
- Save common workflows as command templates in `.claude/commands/`
- Test MTP operations with actual devices when possible
- Handle graceful degradation when MTP tools are unavailable
- Follow Conventional Commits format for all commits
- Always check git status before committing to ensure clean working directory