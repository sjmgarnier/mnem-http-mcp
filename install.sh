#!/usr/bin/env bash
set -euo pipefail

REPO="sjmgarnier/mnem-http-mcp"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="mnem-http-mcp"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

case "$OS" in
  linux)  PLATFORM="linux-$ARCH" ;;
  darwin) PLATFORM="darwin-$ARCH" ;;
  msys*|cygwin*|mingw*) PLATFORM="windows-x64"; BINARY_NAME="mnem-http-mcp.exe" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

ARTIFACT="mnem-http-mcp-${PLATFORM}"
case "$OS" in msys*|cygwin*|mingw*) ARTIFACT="${ARTIFACT}.exe" ;; esac

echo "Downloading mnem-http-mcp for $PLATFORM..."
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')
URL="https://github.com/$REPO/releases/download/$LATEST/$ARTIFACT"

mkdir -p "$INSTALL_DIR"
curl -fsSL "$URL" -o "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo "Installed $BINARY_NAME to $INSTALL_DIR/$BINARY_NAME"
echo ""
echo "Next: run 'mnem-http-mcp integrate' to configure your MCP host."
echo "(Make sure $INSTALL_DIR is in your PATH)"
