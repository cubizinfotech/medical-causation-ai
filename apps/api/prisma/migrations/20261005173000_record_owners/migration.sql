-- Records belong to the signed-in user. Older rows stay unowned and are not listed.
ALTER TABLE "cases"."analysis_cases" ADD COLUMN "owner_user_id" UUID;
CREATE INDEX "analysis_cases_owner_user_id_created_at_idx"
  ON "cases"."analysis_cases" ("owner_user_id", "created_at" DESC);

ALTER TABLE "ewi"."investigations" ADD COLUMN "owner_user_id" UUID;
CREATE INDEX "investigations_owner_user_id_created_at_idx"
  ON "ewi"."investigations" ("owner_user_id", "created_at" DESC);
