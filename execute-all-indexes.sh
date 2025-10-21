#!/bin/bash

API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA"
URL="https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/rpc/exec_raw_sql"

execute_sql() {
  local sql="$1"
  local name="$2"
  echo "Creating index: $name"

  response=$(curl -s -X POST "$URL" \
    -H "apikey: $API_KEY" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"sql_query\": \"$sql\"}")

  if echo "$response" | grep -q "SUCCESS"; then
    echo "✅ $name created successfully"
  else
    echo "❌ $name failed: $response"
  fi
  sleep 1
}

echo "🚀 Creating all critical performance indexes..."
echo ""

# USERS TABLE
execute_sql "CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id)" "idx_users_practice_id"
execute_sql "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)" "idx_users_email"
execute_sql "CREATE INDEX IF NOT EXISTS idx_users_practice_role ON users(practice_id, role)" "idx_users_practice_role"

# PRACTICES TABLE
execute_sql "CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status)" "idx_practices_status"

# PATIENTS TABLE
execute_sql "CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id)" "idx_patients_practice_id"
execute_sql "CREATE INDEX IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at DESC)" "idx_patients_practice_created"

# VISITS TABLE - MOST CRITICAL
execute_sql "CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id)" "idx_visits_practice_id"
execute_sql "CREATE INDEX IF NOT EXISTS idx_visits_practice_scheduled ON visits(practice_id, scheduled_date)" "idx_visits_practice_scheduled"
execute_sql "CREATE INDEX IF NOT EXISTS idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC)" "idx_visits_patient_scheduled"

# NOTIFICATIONS TABLE
execute_sql "CREATE INDEX IF NOT EXISTS idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC)" "idx_notif_user_practice_created"

# CHANNEL MEMBERS TABLE
execute_sql "CREATE INDEX IF NOT EXISTS idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id)" "idx_channel_members_user_practice"

# COMMUNICATION SUBSCRIPTIONS
execute_sql "CREATE INDEX IF NOT EXISTS idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status)" "idx_sms_sub_practice_status"
execute_sql "CREATE INDEX IF NOT EXISTS idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status)" "idx_email_sub_practice_status"

echo ""
echo "✅ All indexes created!"
