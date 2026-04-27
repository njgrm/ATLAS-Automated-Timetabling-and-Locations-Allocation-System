ALTER TABLE "faculty_mirrors"
ADD COLUMN "avatar_url" TEXT;

CREATE TYPE "room_request_appeal_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'UPHELD', 'DENIED');

CREATE TYPE "room_request_appeal_history_action" AS ENUM ('CREATED', 'STATUS_CHANGED', 'NOTE_ADDED', 'DECISION_RECORDED');

CREATE TABLE "room_request_appeals" (
	"id" SERIAL NOT NULL,
	"school_id" INTEGER NOT NULL,
	"school_year_id" INTEGER NOT NULL,
	"run_id" INTEGER NOT NULL,
	"request_id" INTEGER NOT NULL,
	"requester_id" INTEGER NOT NULL,
	"reason" TEXT NOT NULL,
	"status" "room_request_appeal_status" NOT NULL DEFAULT 'OPEN',
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "room_request_appeals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "room_request_appeals_school_id_school_year_id_run_id_idx"
ON "room_request_appeals" ("school_id", "school_year_id", "run_id");

CREATE INDEX "room_request_appeals_request_id_idx"
ON "room_request_appeals" ("request_id");

CREATE INDEX "room_request_appeals_requester_id_idx"
ON "room_request_appeals" ("requester_id");

ALTER TABLE "room_request_appeals"
ADD CONSTRAINT "room_request_appeals_request_id_fkey"
FOREIGN KEY ("request_id") REFERENCES "faculty_room_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "room_request_appeals"
ADD CONSTRAINT "room_request_appeals_requester_id_fkey"
FOREIGN KEY ("requester_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "room_request_appeal_history" (
	"id" SERIAL NOT NULL,
	"appeal_id" INTEGER NOT NULL,
	"actor_id" INTEGER NOT NULL,
	"action" "room_request_appeal_history_action" NOT NULL,
	"from_status" "room_request_appeal_status",
	"to_status" "room_request_appeal_status",
	"note" TEXT,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "room_request_appeal_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "room_request_appeal_history_appeal_id_created_at_idx"
ON "room_request_appeal_history" ("appeal_id", "created_at");

ALTER TABLE "room_request_appeal_history"
ADD CONSTRAINT "room_request_appeal_history_appeal_id_fkey"
FOREIGN KEY ("appeal_id") REFERENCES "room_request_appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
