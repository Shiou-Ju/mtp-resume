#!/bin/bash

# Test enhanced CLI commands

echo "🚀 測試增強版 MTP Transfer CLI"
echo "================================"

# Build the CLI package
echo "1. 編譯 CLI 套件..."
pnpm --filter @mtp-transfer/cli build

# Test enhanced detect command
echo -e "\n2. 測試增強版 detect 命令..."
node dist/index-enhanced.js detect --verbose

# Test enhanced list command
echo -e "\n3. 測試增強版 list 命令..."
node dist/index-enhanced.js list --detailed

# Test help
echo -e "\n4. 測試 help 輸出..."
node dist/index-enhanced.js --help

echo -e "\n✅ 測試完成！"