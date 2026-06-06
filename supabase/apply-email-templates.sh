#!/bin/bash
# Supabase имэйл template-үүдийг Management API-аар шинэчлэх
# Хэрэглэх: SUPABASE_ACCESS_TOKEN=sbp_xxx bash supabase/apply-email-templates.sh

set -e

PROJECT_REF="idomtybdmqhsxbuttubk"
TOKEN="${SUPABASE_ACCESS_TOKEN:?'SUPABASE_ACCESS_TOKEN орчны хувьсагч тохируулаагүй байна'}"
DIR="$(cd "$(dirname "$0")/templates" && pwd)"

echo "📧 DartMN имэйл template-үүдийг шинэчилж байна..."

# JSON payload — Python-оор файлуудыг escape хийж JSON бүтцэд оруулна
PAYLOAD=$(python3 - <<PYEOF
import json, sys

def read(name):
    with open("$DIR/" + name) as f:
        return f.read()

print(json.dumps({
    "mailer_subjects_confirmation": "DartMN — Имэйл баталгаажуулах",
    "mailer_subjects_recovery":     "DartMN — Нууц үг сэргээх",
    "mailer_subjects_magic_link":   "DartMN — Нэвтрэх холбоос",
    "mailer_subjects_email_change": "DartMN — Имэйл хаяг өөрчлөх",
    "mailer_templates_confirmation_content": read("confirm-signup.html"),
    "mailer_templates_recovery_content":     read("reset-password.html"),
    "mailer_templates_magic_link_content":   read("magic-link.html"),
    "mailer_templates_email_change_content": read("email-change.html"),
}))
PYEOF
)

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (compatible; supabase-cli/1.0)" \
  -H "Accept: application/json" \
  --data-raw "$PAYLOAD")

HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Бүх template амжилттай шинэчлэгдлээ!"
else
  echo "❌ Алдаа $HTTP_CODE: $HTTP_BODY"
  exit 1
fi
