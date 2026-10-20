#!/usr/bin/env bash
# Runs MongoDB without Docker: downloads the official binary into .mongo/ on first run,
# then starts mongod on localhost:27017 with data stored in .mongo/data.
set -euo pipefail

VERSION="7.0.14"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.mongo"
BIN="$DIR/bin/mongod"

if [ ! -x "$BIN" ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PKG="mongodb-macos-arm64-$VERSION" ;;
    Darwin-x86_64) PKG="mongodb-macos-x86_64-$VERSION" ;;
    *) echo "Unsupported platform for auto-download; use 'npm run db:up' (Docker) instead." >&2; exit 1 ;;
  esac
  echo "Downloading MongoDB $VERSION (~70 MB, one-time)..."
  mkdir -p "$DIR"
  curl -fL --progress-bar -C - -o "$DIR/mongodb.tgz" "https://fastdl.mongodb.org/osx/$PKG.tgz"
  tar xzf "$DIR/mongodb.tgz" -C "$DIR"
  mkdir -p "$DIR/bin"
  # the archive extracts to e.g. mongodb-macos-aarch64-<version>, not the download name
  cp "$DIR"/mongodb-macos-*-"$VERSION"/bin/* "$DIR/bin/"
  rm -rf "$DIR"/mongodb-macos-*-"$VERSION" "$DIR/mongodb.tgz"
fi

mkdir -p "$DIR/data"
echo "MongoDB running on mongodb://localhost:27017 (Ctrl+C to stop)"
exec "$BIN" --dbpath "$DIR/data" --bind_ip 127.0.0.1 --port 27017 --quiet
