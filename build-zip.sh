#!/bin/bash
# Builds the plugin's ZIP: everything in git, which leaves out node_modules. usage: ./build-zip.sh <folder to put it in>
set -eu
cd "$(dirname "$0")"
version=$(node -p "require('./.claude-plugin/plugin.json').version")
out="${1:?usage: ./build-zip.sh <folder>}/parival-by-grownoli-$version.zip"
[ -z "$(git status --porcelain)" ] || { echo "Commit first: the ZIP is made from the last commit."; exit 1; }
rm -f "$out"
git archive --format=zip -o "$out" HEAD
echo "$out"
