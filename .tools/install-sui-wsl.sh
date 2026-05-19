#!/usr/bin/env bash
# Install `sui` for WSL Bash on Windows (user: run with: bash install-sui-wsl.sh)
set -eu

SUI_WIN='/mnt/e/sui energy architecture/.tools/sui-bin/sui.exe'
BIN_DIR="$HOME/.local/bin"
MARKER="$BIN_DIR/sui"
WRAPPER="$BIN_DIR/sui"

mkdir -p "$BIN_DIR"

if [[ -x "$SUI_WIN" ]]; then
  cat > "$WRAPPER" <<'EOF'
#!/usr/bin/env bash
exec "/mnt/e/sui energy architecture/.tools/sui-bin/sui.exe" "$@"
EOF
  chmod +x "$WRAPPER"
  echo "Installed wrapper -> Windows sui.exe"
  "$WRAPPER" --version
else
  echo "Windows binary not found at: $SUI_WIN"
  echo "Download Linux build instead..."
  VERSION=testnet-v1.72.1
  TMP=$(mktemp -d)
  cd "$TMP"
  URL="https://github.com/MystenLabs/sui/releases/download/${VERSION}/sui-${VERSION}-ubuntu-x86_64.tgz"
  curl -fL -o sui.tgz "$URL"
  tar -xzf sui.tgz
  cp -f "$(find . -name sui -type f | head -1)" "$WRAPPER"
  chmod +x "$WRAPPER"
  rm -rf "$TMP"
  "$WRAPPER" --version
fi

# Ensure ~/.local/bin is on PATH
BASHRC="$HOME/.bashrc"
LINE='export PATH="$HOME/.local/bin:$PATH"'
if ! grep -qF '.local/bin' "$BASHRC" 2>/dev/null; then
  printf '\n# Sui CLI\n%s\n' "$LINE" >> "$BASHRC"
  echo "Added PATH to $BASHRC"
else
  echo "PATH already configured in $BASHRC"
fi

echo "Done. Open a new terminal or run: source ~/.bashrc"
echo "Then: which sui && sui --version"
