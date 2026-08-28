# EnrollPro Subject Normalization Note

Update the teacher subject constants in `EnrollPro/shared/src/constants/index.ts` so the teacher CRUD form uses the current subject code and checklist labels.

Required changes:

- Replace `VALUES EDUCATION` with `ESP` in `DEPED_TEACHER_SUBJECT_VALUES`.
- Replace the BEC entry `{ value: "VALUES EDUCATION", label: "Values Education / EsP" }` with `{ value: "ESP", label: "Edukasyon sa Pagpapakatao (EsP)" }`.
- Keep `MAJOR IN VALUES EDUCATION` in the specialization list unchanged because it is a degree description, not a subject code.
- Keep the STE checklist aligned to the existing subject groups:
  - Environmental Science
  - Research I / Basic Statistics
  - Basic Statistics
  - Research II / Advanced Statistics
  - Advanced Statistics
  - Biotechnology
  - Research III / Advanced Physics
  - Advanced Physics
  - Advanced Chemistry
  - Electronics
- Keep the SPA checklist aligned to the existing subject groups:
  - Music (Vocal / Instrumental)
  - Visual Arts
  - Theater Arts
  - Media Arts
  - Creative Writing (English / Filipino)
  - Dance

Implementation note:

- If EnrollPro persists teacher subject values that still use `VALUES EDUCATION`, add a data migration so stored records match the new `ESP` value.