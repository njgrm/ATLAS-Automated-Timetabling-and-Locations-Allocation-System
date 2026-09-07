node.exe : warn The configuration property `package.json#prisma` is deprecated 
and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., 
`prisma.config.ts`).
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Users\njgro\AppData\Roaming\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (warn The config...ma.config.ts`). 
   :String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
For more information, see: https://pris.ly/prisma-config

Loaded Prisma config from prisma.config.ts.

warn The Prisma config file in prisma.config.ts overrides the deprecated 
`package.json#prisma` property in package.json.
  For more information, see: https://pris.ly/prisma-config

Prisma config detected, skipping environment variable loading.
-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "program_scopes" "program_type"[] DEFAULT ARRAY['REGULAR']::"program_type"[];

-- CreateTable
CREATE TABLE "class_templates" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "program_type" "program_type" NOT NULL,
    "grade_applicability" INTEGER[],
    "period_length_minutes" INTEGER NOT NULL DEFAULT 50,
    "periods_per_day" INTEGER NOT NULL DEFAULT 8,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_template_subjects" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_template_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_templates_school_id_idx" ON "class_templates"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_class_template_school_program" ON "class_templates"("school_id", "program_type");

-- CreateIndex
CREATE INDEX "class_template_subjects_template_id_idx" ON "class_template_subjects"("template_id");

-- CreateIndex
CREATE INDEX "class_template_subjects_subject_id_idx" ON "class_template_subjects"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_template_subject" ON "class_template_subjects"("template_id", "subject_id");

-- AddForeignKey
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_template_subjects" ADD CONSTRAINT "class_template_subjects_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "class_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_template_subjects" ADD CONSTRAINT "class_template_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

