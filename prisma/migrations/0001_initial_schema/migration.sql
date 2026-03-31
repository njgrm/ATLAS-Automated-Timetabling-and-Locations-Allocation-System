-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "room_type" AS ENUM ('CLASSROOM', 'LABORATORY', 'COMPUTER_LAB', 'TLE_WORKSHOP', 'LIBRARY', 'GYMNASIUM', 'FACULTY_ROOM', 'OFFICE', 'OTHER');

-- CreateTable
CREATE TABLE "schools" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "campus_image_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "building_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "type" "room_type" NOT NULL DEFAULT 'CLASSROOM',
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_minutes_per_week" INTEGER NOT NULL,
    "preferred_room_type" "room_type" NOT NULL DEFAULT 'CLASSROOM',
    "grade_levels" INTEGER[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_seedable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_mirrors" (
    "id" SERIAL NOT NULL,
    "external_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "department" TEXT,
    "contact_info" TEXT,
    "local_notes" TEXT,
    "is_active_for_scheduling" BOOLEAN NOT NULL DEFAULT true,
    "max_hours_per_week" INTEGER NOT NULL DEFAULT 30,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_subjects" (
    "id" SERIAL NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "grade_levels" INTEGER[],
    "assigned_by" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subjects_school_id_idx" ON "subjects"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subjects_school_code" ON "subjects"("school_id", "code");

-- CreateIndex
CREATE INDEX "faculty_mirrors_school_id_idx" ON "faculty_mirrors"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_school_external" ON "faculty_mirrors"("school_id", "external_id");

-- CreateIndex
CREATE INDEX "faculty_subjects_school_id_idx" ON "faculty_subjects"("school_id");

-- CreateIndex
CREATE INDEX "faculty_subjects_faculty_id_idx" ON "faculty_subjects"("faculty_id");

-- CreateIndex
CREATE INDEX "faculty_subjects_subject_id_idx" ON "faculty_subjects"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_subject" ON "faculty_subjects"("faculty_id", "subject_id");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_mirrors" ADD CONSTRAINT "faculty_mirrors_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_subjects" ADD CONSTRAINT "faculty_subjects_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_subjects" ADD CONSTRAINT "faculty_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

