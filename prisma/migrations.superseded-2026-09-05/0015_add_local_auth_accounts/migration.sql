CREATE TABLE "atlas_auth_accounts" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL,
  "faculty_id" INTEGER,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "atlas_auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "atlas_auth_accounts_email_key" ON "atlas_auth_accounts"("email");
CREATE INDEX "atlas_auth_accounts_school_id_role_idx" ON "atlas_auth_accounts"("school_id", "role");
CREATE INDEX "atlas_auth_accounts_faculty_id_idx" ON "atlas_auth_accounts"("faculty_id");

ALTER TABLE "atlas_auth_accounts"
ADD CONSTRAINT "atlas_auth_accounts_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "atlas_auth_accounts"
ADD CONSTRAINT "atlas_auth_accounts_faculty_id_fkey"
FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
