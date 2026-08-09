import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Questions, answers, the updates feed, and the votes and reports that sit on
 * them — plus the four columns on `projects` that hold the responsiveness
 * figures the catalogue badge is drawn from.
 *
 * Same shape as the referral and notification migrations, for the same reason:
 * no transaction, and every statement safe to run twice. A migration that runs
 * on every API boot has to survive being interrupted halfway and started again.
 *
 * `target_type` and `kind` are varchars rather than Postgres enums throughout.
 * An ALTER TYPE cannot run inside a transaction, and these lists will grow the
 * first time anything else on the platform becomes votable.
 */
export class ProjectSocial1786752000000 implements MigrationInterface {
  name = 'ProjectSocial1786752000000';

  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Questions ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_questions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "author_id" uuid,
        "body" text NOT NULL,
        "upvote_count" integer NOT NULL DEFAULT 0,
        "pinned" boolean NOT NULL DEFAULT false,
        "answered_at" TIMESTAMP WITH TIME ZONE,
        "hidden_at" TIMESTAMP WITH TIME ZONE,
        "hidden_reason" character varying,
        "hidden_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_questions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_questions_project_created"
         ON "project_questions" ("project_id", "created_at")`,
    );
    // The founder's queue and the "is anything being ignored" filter both read
    // this, and a project with a long history would otherwise scan all of it.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_questions_unanswered"
         ON "project_questions" ("project_id") WHERE "answered_at" IS NULL AND "hidden_at" IS NULL`,
    );
    // The daily-limit check: this author, in the last 24 hours.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_questions_author_created"
         ON "project_questions" ("author_id", "created_at")`,
    );

    // ── Answers ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_answers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "question_id" uuid NOT NULL,
        "author_id" uuid,
        "body" text NOT NULL,
        "from_founder" boolean NOT NULL DEFAULT false,
        "helpful_count" integer NOT NULL DEFAULT 0,
        "not_answer_count" integer NOT NULL DEFAULT 0,
        "hidden_at" TIMESTAMP WITH TIME ZONE,
        "hidden_reason" character varying,
        "hidden_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_answers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_answers_question_created"
         ON "project_answers" ("question_id", "created_at")`,
    );

    // ── Updates feed ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_updates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "author_id" uuid,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "photos" jsonb,
        "auto" boolean NOT NULL DEFAULT false,
        "auto_payload" jsonb,
        "helpful_count" integer NOT NULL DEFAULT 0,
        "read_count" integer NOT NULL DEFAULT 0,
        "edited_at" TIMESTAMP WITH TIME ZONE,
        "hidden_at" TIMESTAMP WITH TIME ZONE,
        "hidden_reason" character varying,
        "hidden_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_updates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_updates_project_created"
         ON "project_updates" ("project_id", "created_at")`,
    );

    // ── Votes ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_votes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "target_type" character varying NOT NULL,
        "target_id" uuid NOT NULL,
        "kind" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_votes" PRIMARY KEY ("id")
      )
    `);
    // The reason this table exists at all: without it, a counter is a number
    // anybody can raise by tapping, and the sort order built on it is noise.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_content_votes_voter_target_kind"
         ON "content_votes" ("user_id", "target_type", "target_id", "kind")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_content_votes_target"
         ON "content_votes" ("target_type", "target_id")`,
    );

    // ── Reports ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporter_id" uuid,
        "target_type" character varying NOT NULL,
        "target_id" uuid NOT NULL,
        "project_id" uuid,
        "reason" character varying NOT NULL,
        "comment" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "resolved_by_user_id" uuid,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_reports" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_content_reports_reporter_target"
         ON "content_reports" ("reporter_id", "target_type", "target_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_content_reports_status_created"
         ON "content_reports" ("status", "created_at")`,
    );

    // ── Thread subscriptions ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "question_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_question_follows" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_question_follows_user_question"
         ON "question_follows" ("user_id", "question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_question_follows_question"
         ON "question_follows" ("question_id")`,
    );

    // ── The figures on the project ───────────────────────────────────────────
    //
    // Defaults of 0 rather than null: a project nobody has asked anything is one
    // with no questions, not one whose record is unknown, and the badge reads
    // the same either way without the app having to special-case it.
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "questions_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "questions_answered_count" integer NOT NULL DEFAULT 0`,
    );
    // Nullable on purpose: "has never answered anything" is not the same number
    // as "answers instantly", and 0 would read as the second.
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "answer_median_minutes" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "last_update_at" TIMESTAMP WITH TIME ZONE`,
    );

    // ── Foreign keys ─────────────────────────────────────────────────────────
    //
    // ADD CONSTRAINT has no IF NOT EXISTS, hence the DO blocks.
    //
    // Content follows its project: deleting a project takes its questions with
    // it, because a question about a project that no longer exists has no
    // meaning. An author is only ever set to null — the thread survives the
    // account, because the answers under it are part of the project's record and
    // removing half a conversation is worse than keeping an unnamed question.
    const foreignKeys: Array<[string, string, string, string, string]> = [
      ['project_questions', 'FK_project_questions_project', 'project_id', 'projects', 'CASCADE'],
      ['project_questions', 'FK_project_questions_author', 'author_id', 'users', 'SET NULL'],
      ['project_answers', 'FK_project_answers_question', 'question_id', 'project_questions', 'CASCADE'],
      ['project_answers', 'FK_project_answers_author', 'author_id', 'users', 'SET NULL'],
      ['project_updates', 'FK_project_updates_project', 'project_id', 'projects', 'CASCADE'],
      ['project_updates', 'FK_project_updates_author', 'author_id', 'users', 'SET NULL'],
      ['content_votes', 'FK_content_votes_user', 'user_id', 'users', 'CASCADE'],
      ['content_reports', 'FK_content_reports_reporter', 'reporter_id', 'users', 'SET NULL'],
      ['question_follows', 'FK_question_follows_user', 'user_id', 'users', 'CASCADE'],
      ['question_follows', 'FK_question_follows_question', 'question_id', 'project_questions', 'CASCADE'],
    ];

    for (const [table, name, column, references, onDelete] of foreignKeys) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}"
            ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}")
            REFERENCES "${references}"("id") ON DELETE ${onDelete} ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL;
        END $$;
      `);
    }

    // content_votes.target_id and content_reports.target_id deliberately have no
    // foreign key: they point at one of three tables depending on target_type,
    // which is not something a reference can express. A vote left behind by a
    // deleted target is harmless — nothing reads a vote except through its
    // target — and the counters that matter live on the target itself.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting drops what people wrote, which is not recoverable from anywhere
    // else on the platform — unlike a notification, a question is the original.
    // Kept anyway, because a migration that cannot be undone blocks a rollback
    // of everything shipped alongside it; run it knowing what it costs.
    await queryRunner.query(`DROP TABLE IF EXISTS "question_follows"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_updates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_questions"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "questions_count"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "questions_answered_count"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "answer_median_minutes"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "last_update_at"`);
  }
}
