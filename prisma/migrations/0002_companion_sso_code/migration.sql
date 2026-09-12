-- CreateTable
CREATE TABLE "companion_sso_codes" (
    "id" SERIAL NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "user_id" INTEGER,
    "school_id" INTEGER,
    "school_year_id" INTEGER,
    "audience" VARCHAR(32) NOT NULL DEFAULT 'enrollpro',
    "redirect_uri" VARCHAR(512) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_sso_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companion_sso_codes_code_hash_key" ON "companion_sso_codes"("code_hash");

-- CreateIndex
CREATE INDEX "companion_sso_codes_code_hash_consumed_at_idx" ON "companion_sso_codes"("code_hash", "consumed_at");

-- CreateIndex
CREATE INDEX "companion_sso_codes_expires_at_idx" ON "companion_sso_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "companion_sso_codes" ADD CONSTRAINT "companion_sso_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "atlas_auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
