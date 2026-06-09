-- Obuna tariflari (1/3/6/12 oy). To'lov hozircha yo'q — admin qo'lda
-- faollashtiradi; kelajakda Click/Payme ulanganda shu jadval ishlatiladi.
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,                      -- '1m' | '3m' | '6m' | '12m'
  months INTEGER NOT NULL,
  price NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',   -- active | expired | cancelled
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  activated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- admin (qo'lda) yoki NULL
  payment_ref TEXT,                        -- kelajakda to'lov shlyuzi tranzaksiya ID'si
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at);
