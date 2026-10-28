#!/usr/bin/env bash
# 把源码同步进 DSH desktop profile 里 pnpm 拷贝出来的那份安装副本。
# file: 依赖是拷贝而不是链接，所以改完源码必须跑一次本脚本（或重新 dsh plugin add）。
set -euo pipefail
SRC="D:/aiprojects/dsh-agentbase"
DST="E:/DshData/.dsh/profiles/desktop/node_modules/@local/dsh-agentbase"
for f in index.js data.js client.js package.json cordis.patch.yml icon.svg; do
  cp -f "$SRC/$f" "$DST/$f"
done
mkdir -p "$DST/locale"
cp -f "$SRC/locale/"*.json "$DST/locale/"
echo "synced -> $DST"
