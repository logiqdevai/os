-- 01 §74: TOTP seeds must be decrypted to verify codes, so they are stored encrypted (secret-box), not hashed.
ALTER TABLE "user_auth_methods" ADD COLUMN "secret_ciphertext" TEXT;
