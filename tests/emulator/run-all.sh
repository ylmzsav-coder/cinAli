#!/usr/bin/env bash
# Sunucu (emülatör) testlerini sırayla çalıştırır; biri bile başarısızsa çıkış kodu 1.
# Argüman verilirse yalnızca o dosyalar (CI'da iki parça paralel çalışır), yoksa hepsi.
set -u
cd "$(dirname "$0")/../.."
fail=0
files=("$@")
[ ${#files[@]} -eq 0 ] && files=(tests/emulator/*.mjs)
for t in "${files[@]}"; do
  echo "== $t"
  out=$(npx firebase emulators:exec --project demo-cinali --only auth,firestore,functions "node $t" 2>&1)
  code=$?
  echo "$out" | grep -E "^✓|^✗|HEPSİ|HATA|^[a-zçğıöşü ]+:" | grep -v EAFNOSUPPORT
  if [ $code -ne 0 ] || echo "$out" | grep -qE "^✗|HATA VAR"; then echo "::error::$t başarısız"; fail=1; fi
done
exit $fail
