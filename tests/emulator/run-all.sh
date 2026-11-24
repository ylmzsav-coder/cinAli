#!/usr/bin/env bash
# Bütün sunucu (emülatör) testlerini sırayla çalıştırır; biri bile başarısızsa çıkış kodu 1.
set -u
cd "$(dirname "$0")/../.."
fail=0
for t in tests/emulator/*.mjs; do
  echo "== $t"
  out=$(npx firebase emulators:exec --project demo-cinali --only auth,firestore,functions "node $t" 2>&1)
  code=$?
  echo "$out" | grep -E "^✓|^✗|HEPSİ|HATA|^[a-zçğıöşü ]+:" | grep -v EAFNOSUPPORT
  if [ $code -ne 0 ] || echo "$out" | grep -qE "^✗|HATA VAR"; then echo "::error::$t başarısız"; fail=1; fi
done
exit $fail
