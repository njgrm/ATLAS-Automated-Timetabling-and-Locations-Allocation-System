-- AlterTable
ALTER TABLE "faculty_mirrors" ADD COLUMN "plantilla_position" VARCHAR(100),
ADD COLUMN "designation_title" VARCHAR(100),
ADD COLUMN "undergraduate_degree" VARCHAR(255),
ADD COLUMN "postgraduate_degree" VARCHAR(255),
ADD COLUMN "major_specialization" VARCHAR(100),
ADD COLUMN "minor_specialization" VARCHAR(100),
ADD COLUMN "ancillary_roles" TEXT[] NOT NULL DEFAULT '{}';
