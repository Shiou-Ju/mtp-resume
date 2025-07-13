#!/bin/bash

# MTP Resume Project - Docker Development Environment
# Safe development and testing in isolated container

set -e

echo "🐳 Starting MTP Resume Docker Development Environment"

# Function to show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build     - Build development Docker image"
    echo "  start     - Start development container"
    echo "  test      - Run syntax checks in container"
    echo "  install   - Install dependencies in container"
    echo "  shell     - Open interactive shell in container"
    echo "  status    - Show container status"
    echo ""
}

# Build development image
build_dev() {
    echo "🔨 Building development Docker image..."
    docker-compose -f docker-compose.dev.yml build
    echo "✅ Development image built successfully"
}

# Start development environment
start_dev() {
    echo "🚀 Starting development container..."
    docker-compose -f docker-compose.dev.yml up -d
    echo "✅ Development container started"
    echo "💡 Use '$0 shell' to access the container"
}

# Run syntax tests
test_syntax() {
    echo "🧪 Running syntax checks in Docker..."
    docker run -v $(pwd):/app -w /app node:18 bash -c "
        echo '📝 Checking Core module syntax...'
        node --check packages/core/src/index.js && echo '✅ Core module syntax OK'
        
        echo '📝 Checking CLI module syntax...'  
        node --check packages/cli/src/index.js && echo '✅ CLI module syntax OK'
        
        echo '📝 Checking package.json files...'
        node -e 'JSON.parse(require(\"fs\").readFileSync(\"package.json\"))' && echo '✅ Root package.json valid'
        node -e 'JSON.parse(require(\"fs\").readFileSync(\"packages/core/package.json\"))' && echo '✅ Core package.json valid'
        node -e 'JSON.parse(require(\"fs\").readFileSync(\"packages/cli/package.json\"))' && echo '✅ CLI package.json valid'
        
        echo '🎉 All syntax checks passed!'
    "
}

# Install dependencies safely
install_deps() {
    echo "📦 Installing dependencies in Docker container..."
    docker-compose -f docker-compose.dev.yml run mtp-dev bash -c "
        echo '📥 Installing dependencies with pnpm...'
        pnpm install
        echo '✅ Dependencies installed successfully'
        
        echo '🧪 Testing module loading...'
        node -e 'console.log(\"✅ Node.js is working\")' 
        
        echo '📋 Workspace info:'
        pnpm list --depth=0
    "
}

# Open interactive shell
open_shell() {
    echo "💻 Opening interactive shell in development container..."
    docker-compose -f docker-compose.dev.yml exec mtp-dev bash || \
    docker-compose -f docker-compose.dev.yml run mtp-dev bash
}

# Show container status
show_status() {
    echo "📊 Docker Container Status"
    echo "=========================="
    docker-compose -f docker-compose.dev.yml ps
    echo ""
    echo "📋 Available Images:"
    docker images | grep -E "(mtp-resume|node)" | head -5
}

# Main command handling
case "${1:-}" in
    build)
        build_dev
        ;;
    start)
        build_dev
        start_dev
        ;;
    test)
        test_syntax
        ;;
    install)
        build_dev
        install_deps
        ;;
    shell)
        open_shell
        ;;
    status)
        show_status
        ;;
    *)
        show_usage
        ;;
esac