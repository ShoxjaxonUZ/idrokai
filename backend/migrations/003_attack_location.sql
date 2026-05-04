-- attack_logs ga aniq joylashuv ma'lumotlari qo'shish
-- Avvalgi: country, city, isp
-- Yangi: region (viloyat/shtat), latitude, longitude, timezone, postal, asn

ALTER TABLE attack_logs ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE attack_logs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE attack_logs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE attack_logs ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE attack_logs ADD COLUMN IF NOT EXISTS postal TEXT;
ALTER TABLE attack_logs ADD COLUMN IF NOT EXISTS asn TEXT;
