


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."ato_get_chunks"("chunk_ids" "text"[], "neighbours" integer DEFAULT 0, "pit_date" "date" DEFAULT NULL::"date") RETURNS TABLE("chunk_id" "text", "doc_id" "text", "ord" integer, "text" "text", "heading_path" "text"[], "score" real, "title" "text", "url" "text", "doc_type" "text", "snippet" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  wanted TEXT[];
  target RECORD;
  n      INT;
BEGIN
  wanted := chunk_ids;
  FOR target IN
    SELECT c.chunk_id, c.doc_id, c.ord
    FROM chunks c
    WHERE c.chunk_id = ANY(chunk_ids)
  LOOP
    FOR n IN 1..neighbours LOOP
      wanted := array_append(wanted, (target.doc_id || '#' || (target.ord - n)::TEXT));
      wanted := array_append(wanted, (target.doc_id || '#' || (target.ord + n)::TEXT));
    END LOOP;
  END LOOP;

  RETURN QUERY
    SELECT
      c.chunk_id,
      c.doc_id,
      c.ord,
      c.text,
      c.heading_path,
      0.0::REAL AS score,
      d.title,
      d.url,
      d.doc_type,
      left(c.text, 280) AS snippet
    FROM chunks c
    JOIN docs d USING (doc_id)
    WHERE c.chunk_id = ANY(wanted)
      AND (
        pit_date IS NULL
        OR (
          (c.effective_from IS NULL OR c.effective_from <= pit_date)
          AND (c.effective_to IS NULL OR c.effective_to > pit_date)
        )
      )
    ORDER BY c.doc_id, c.ord;
END;
$$;


ALTER FUNCTION "public"."ato_get_chunks"("chunk_ids" "text"[], "neighbours" integer, "pit_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ato_get_definition"("p_term" "text", "pit_date" "date" DEFAULT NULL::"date") RETURNS TABLE("term" "text", "doc_id" "text", "anchor_id" "text", "body" "text", "effective_from" "date", "effective_to" "date")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    def.term,
    def.doc_id,
    def.anchor_id,
    def.body,
    def.effective_from,
    def.effective_to
  FROM definitions def
  WHERE lower(def.term) = lower(p_term)
    AND (
      pit_date IS NULL
      OR (
        (def.effective_from IS NULL OR def.effective_from <= pit_date)
        AND (def.effective_to IS NULL OR def.effective_to > pit_date)
      )
    )
  ORDER BY def.effective_from DESC NULLS LAST;
$$;


ALTER FUNCTION "public"."ato_get_definition"("p_term" "text", "pit_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ato_get_doc"("doc_id" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT jsonb_build_object(
    'doc',          row_to_json(d)::JSONB,
    'cleaned_html', NULL,
    'anchors',      COALESCE(
                      (SELECT jsonb_agg(row_to_json(a))
                       FROM anchors a WHERE a.doc_id = d.doc_id),
                      '[]'::JSONB
                    )
  )
  FROM docs d
  WHERE d.doc_id = ato_get_doc.doc_id;
$$;


ALTER FUNCTION "public"."ato_get_doc"("doc_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ato_get_doc_anchors"("doc_id" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT jsonb_build_object(
    'anchors',  COALESCE(
                  (SELECT jsonb_agg(row_to_json(a))
                   FROM anchors a WHERE a.doc_id = ato_get_doc_anchors.doc_id),
                  '[]'::JSONB
                ),
    'inbound',  COALESCE(
                  (SELECT jsonb_agg(row_to_json(ci))
                   FROM citations ci WHERE ci.to_doc_id = ato_get_doc_anchors.doc_id),
                  '[]'::JSONB
                ),
    'outbound', COALESCE(
                  (SELECT jsonb_agg(row_to_json(co))
                   FROM citations co
                   JOIN chunks ck ON ck.chunk_id = co.from_chunk_id
                   WHERE ck.doc_id = ato_get_doc_anchors.doc_id),
                  '[]'::JSONB
                )
  );
$$;


ALTER FUNCTION "public"."ato_get_doc_anchors"("doc_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ato_get_threshold"("p_name" "text", "pit_date" "date" DEFAULT NULL::"date") RETURNS TABLE("name" "text", "value" numeric, "unit" "text", "effective_from" "date", "effective_to" "date", "source_doc_id" "text", "source_anchor" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    t.name,
    t.value,
    t.unit,
    t.effective_from,
    t.effective_to,
    t.source_doc_id,
    t.source_anchor
  FROM thresholds t
  WHERE t.name = p_name
    AND (
      pit_date IS NULL
      OR (
        (t.effective_from IS NULL OR t.effective_from <= pit_date)
        AND (t.effective_to IS NULL OR t.effective_to > pit_date)
      )
    )
  ORDER BY t.effective_from DESC NULLS LAST
  LIMIT 1;
$$;


ALTER FUNCTION "public"."ato_get_threshold"("p_name" "text", "pit_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ato_keyword_search"("q" "text", "k" integer, "pit_date" "date" DEFAULT NULL::"date") RETURNS TABLE("chunk_id" "text", "doc_id" "text", "ord" integer, "text" "text", "heading_path" "text"[], "score" real, "title" "text", "url" "text", "doc_type" "text", "snippet" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    c.chunk_id,
    c.doc_id,
    c.ord,
    c.text,
    c.heading_path,
    ts_rank(c.tsv, websearch_to_tsquery('english', q))::REAL AS score,
    d.title,
    d.url,
    d.doc_type,
    left(c.text, 280) AS snippet
  FROM chunks c
  JOIN docs d USING (doc_id)
  WHERE c.tsv @@ websearch_to_tsquery('english', q)
    AND (
      pit_date IS NULL
      OR (
        (c.effective_from IS NULL OR c.effective_from <= pit_date)
        AND (c.effective_to IS NULL OR c.effective_to > pit_date)
      )
    )
  ORDER BY score DESC
  LIMIT k;
$$;


ALTER FUNCTION "public"."ato_keyword_search"("q" "text", "k" integer, "pit_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ato_vector_search"("q_embedding" "public"."vector", "k" integer, "pit_date" "date" DEFAULT NULL::"date") RETURNS TABLE("chunk_id" "text", "doc_id" "text", "ord" integer, "text" "text", "heading_path" "text"[], "score" real, "title" "text", "url" "text", "doc_type" "text", "snippet" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    c.chunk_id,
    c.doc_id,
    c.ord,
    c.text,
    c.heading_path,
    (1 - (c.embedding <=> q_embedding))::REAL AS score,
    d.title,
    d.url,
    d.doc_type,
    left(c.text, 280) AS snippet
  FROM chunks c
  JOIN docs d USING (doc_id)
  WHERE c.embedding IS NOT NULL
    AND (
      pit_date IS NULL
      OR (
        (c.effective_from IS NULL OR c.effective_from <= pit_date)
        AND (c.effective_to IS NULL OR c.effective_to > pit_date)
      )
    )
  ORDER BY c.embedding <=> q_embedding
  LIMIT k;
$$;


ALTER FUNCTION "public"."ato_vector_search"("q_embedding" "public"."vector", "k" integer, "pit_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_chunk_embeddings"("payload" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  n INT;
BEGIN
  WITH updates AS (
    SELECT
      (elem->>'chunk_id')::TEXT  AS chunk_id,
      (elem->>'embedding')::vector(384) AS embedding
    FROM jsonb_array_elements(payload) AS elem
  )
  UPDATE chunks c
     SET embedding = u.embedding
    FROM updates u
   WHERE c.chunk_id = u.chunk_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;


ALTER FUNCTION "public"."bulk_update_chunk_embeddings"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."anchors" (
    "anchor_id" "text" NOT NULL,
    "doc_id" "text" NOT NULL,
    "anchor_name" "text" NOT NULL,
    "chunk_id" "text" NOT NULL
);


ALTER TABLE "public"."anchors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bearer_tokens" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."bearer_tokens" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bearer_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bearer_tokens_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bearer_tokens_id_seq" OWNED BY "public"."bearer_tokens"."id";



CREATE TABLE IF NOT EXISTS "public"."chunks" (
    "chunk_id" "text" NOT NULL,
    "doc_id" "text" NOT NULL,
    "ord" integer NOT NULL,
    "text" "text" NOT NULL,
    "heading_path" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "effective_from" "date",
    "effective_to" "date",
    "char_start" integer DEFAULT 0 NOT NULL,
    "char_end" integer DEFAULT 0 NOT NULL,
    "tsv" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", "text")) STORED,
    "embedding" "public"."vector"(384)
);


ALTER TABLE "public"."chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."citations" (
    "id" bigint NOT NULL,
    "from_chunk_id" "text" NOT NULL,
    "to_doc_id" "text" NOT NULL,
    "to_anchor" "text" DEFAULT ''::"text" NOT NULL,
    "citation_kind" "text" DEFAULT 'reference'::"text" NOT NULL
);


ALTER TABLE "public"."citations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."citations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."citations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."citations_id_seq" OWNED BY "public"."citations"."id";



CREATE TABLE IF NOT EXISTS "public"."definitions" (
    "id" bigint NOT NULL,
    "term" "text" NOT NULL,
    "doc_id" "text" NOT NULL,
    "anchor_id" "text",
    "body" "text" NOT NULL,
    "effective_from" "date",
    "effective_to" "date"
);


ALTER TABLE "public"."definitions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."definitions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."definitions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."definitions_id_seq" OWNED BY "public"."definitions"."id";



CREATE TABLE IF NOT EXISTS "public"."docs" (
    "doc_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "jurisdiction" "text" DEFAULT 'AU'::"text" NOT NULL,
    "doc_type" "text" DEFAULT ''::"text" NOT NULL,
    "effective_from" "date",
    "effective_to" "date",
    "published_at" "date",
    "retrieved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "docs_source_check" CHECK (("source" = ANY (ARRAY['ato'::"text", 'legislation'::"text", 'austlii'::"text", 'state_revenue'::"text"])))
);


ALTER TABLE "public"."docs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_connections" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_version" "text"
);


ALTER TABLE "public"."mcp_connections" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mcp_connections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mcp_connections_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mcp_connections_id_seq" OWNED BY "public"."mcp_connections"."id";



CREATE TABLE IF NOT EXISTS "public"."meta" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."meta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thresholds" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" DEFAULT 'AUD'::"text" NOT NULL,
    "effective_from" "date",
    "effective_to" "date",
    "source_doc_id" "text",
    "source_anchor" "text"
);


ALTER TABLE "public"."thresholds" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."thresholds_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."thresholds_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."thresholds_id_seq" OWNED BY "public"."thresholds"."id";



CREATE TABLE IF NOT EXISTS "public"."usage_events" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "usage_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['mcp_started'::"text", 'heartbeat'::"text", 'update_check'::"text", 'update_applied'::"text", 'facts_pulled'::"text"])))
);


ALTER TABLE "public"."usage_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."usage_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."usage_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."usage_events_id_seq" OWNED BY "public"."usage_events"."id";



CREATE TABLE IF NOT EXISTS "public"."user_facts" (
    "user_id" "text" NOT NULL,
    "facts" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_facts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "user_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bearer_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bearer_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."citations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."citations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."definitions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."definitions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mcp_connections" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mcp_connections_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."thresholds" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."thresholds_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."usage_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."usage_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."anchors"
    ADD CONSTRAINT "anchors_pkey" PRIMARY KEY ("anchor_id");



ALTER TABLE ONLY "public"."bearer_tokens"
    ADD CONSTRAINT "bearer_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bearer_tokens"
    ADD CONSTRAINT "bearer_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."chunks"
    ADD CONSTRAINT "chunks_pkey" PRIMARY KEY ("chunk_id");



ALTER TABLE ONLY "public"."citations"
    ADD CONSTRAINT "citations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."definitions"
    ADD CONSTRAINT "definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."docs"
    ADD CONSTRAINT "docs_pkey" PRIMARY KEY ("doc_id");



ALTER TABLE ONLY "public"."mcp_connections"
    ADD CONSTRAINT "mcp_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta"
    ADD CONSTRAINT "meta_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."thresholds"
    ADD CONSTRAINT "thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."citations"
    ADD CONSTRAINT "uq_citations_natural" UNIQUE ("from_chunk_id", "to_doc_id", "to_anchor", "citation_kind");



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_facts"
    ADD CONSTRAINT "user_facts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "anchors_doc_id_idx" ON "public"."anchors" USING "btree" ("doc_id");



CREATE INDEX "bearer_tokens_token_hash_idx" ON "public"."bearer_tokens" USING "btree" ("token_hash");



CREATE INDEX "bearer_tokens_user_id_idx" ON "public"."bearer_tokens" USING "btree" ("user_id");



CREATE INDEX "chunks_doc_id_ord_idx" ON "public"."chunks" USING "btree" ("doc_id", "ord");



CREATE INDEX "chunks_effective_idx" ON "public"."chunks" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "chunks_embedding_idx" ON "public"."chunks" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "chunks_tsv_idx" ON "public"."chunks" USING "gin" ("tsv");



CREATE INDEX "citations_from_idx" ON "public"."citations" USING "btree" ("from_chunk_id");



CREATE INDEX "citations_to_idx" ON "public"."citations" USING "btree" ("to_doc_id");



CREATE INDEX "definitions_doc_id_idx" ON "public"."definitions" USING "btree" ("doc_id");



CREATE INDEX "definitions_term_idx" ON "public"."definitions" USING "btree" ("lower"("term"));



CREATE INDEX "docs_doc_type_idx" ON "public"."docs" USING "btree" ("doc_type");



CREATE INDEX "docs_effective_idx" ON "public"."docs" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "docs_source_idx" ON "public"."docs" USING "btree" ("source");



CREATE UNIQUE INDEX "mcp_connections_user_id_uidx" ON "public"."mcp_connections" USING "btree" ("user_id");



CREATE INDEX "thresholds_effective_idx" ON "public"."thresholds" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "thresholds_name_idx" ON "public"."thresholds" USING "btree" ("name");



CREATE INDEX "usage_events_time_idx" ON "public"."usage_events" USING "btree" ("event_time");



CREATE INDEX "usage_events_type_idx" ON "public"."usage_events" USING "btree" ("event_type");



CREATE INDEX "usage_events_user_id_idx" ON "public"."usage_events" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."anchors"
    ADD CONSTRAINT "anchors_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("chunk_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anchors"
    ADD CONSTRAINT "anchors_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("doc_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bearer_tokens"
    ADD CONSTRAINT "bearer_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chunks"
    ADD CONSTRAINT "chunks_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("doc_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."citations"
    ADD CONSTRAINT "citations_from_chunk_id_fkey" FOREIGN KEY ("from_chunk_id") REFERENCES "public"."chunks"("chunk_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."citations"
    ADD CONSTRAINT "citations_to_doc_id_fkey" FOREIGN KEY ("to_doc_id") REFERENCES "public"."docs"("doc_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."definitions"
    ADD CONSTRAINT "definitions_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("doc_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_connections"
    ADD CONSTRAINT "mcp_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thresholds"
    ADD CONSTRAINT "thresholds_source_doc_id_fkey" FOREIGN KEY ("source_doc_id") REFERENCES "public"."docs"("doc_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_facts"
    ADD CONSTRAINT "user_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE "public"."anchors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bearer_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."citations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "corpus_public_read" ON "public"."anchors" FOR SELECT USING (true);



CREATE POLICY "corpus_public_read" ON "public"."chunks" FOR SELECT USING (true);



CREATE POLICY "corpus_public_read" ON "public"."citations" FOR SELECT USING (true);



CREATE POLICY "corpus_public_read" ON "public"."definitions" FOR SELECT USING (true);



CREATE POLICY "corpus_public_read" ON "public"."docs" FOR SELECT USING (true);



CREATE POLICY "corpus_public_read" ON "public"."meta" FOR SELECT USING (true);



CREATE POLICY "corpus_public_read" ON "public"."thresholds" FOR SELECT USING (true);



ALTER TABLE "public"."definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."docs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_self_select" ON "public"."usage_events" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "facts_self_all" ON "public"."user_facts" USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "mcp_conn_self_select" ON "public"."mcp_connections" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



ALTER TABLE "public"."mcp_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thresholds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tokens_deny_all" ON "public"."bearer_tokens" USING (false);



ALTER TABLE "public"."usage_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_facts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_self_select" ON "public"."users" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "users_self_update" ON "public"."users" FOR UPDATE USING (("user_id" = ("auth"."uid"())::"text"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."ato_get_chunks"("chunk_ids" "text"[], "neighbours" integer, "pit_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."ato_get_chunks"("chunk_ids" "text"[], "neighbours" integer, "pit_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ato_get_chunks"("chunk_ids" "text"[], "neighbours" integer, "pit_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."ato_get_definition"("p_term" "text", "pit_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."ato_get_definition"("p_term" "text", "pit_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ato_get_definition"("p_term" "text", "pit_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."ato_get_doc"("doc_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ato_get_doc"("doc_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ato_get_doc"("doc_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ato_get_doc_anchors"("doc_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ato_get_doc_anchors"("doc_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ato_get_doc_anchors"("doc_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ato_get_threshold"("p_name" "text", "pit_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."ato_get_threshold"("p_name" "text", "pit_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ato_get_threshold"("p_name" "text", "pit_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."ato_keyword_search"("q" "text", "k" integer, "pit_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."ato_keyword_search"("q" "text", "k" integer, "pit_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ato_keyword_search"("q" "text", "k" integer, "pit_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."ato_vector_search"("q_embedding" "public"."vector", "k" integer, "pit_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."ato_vector_search"("q_embedding" "public"."vector", "k" integer, "pit_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ato_vector_search"("q_embedding" "public"."vector", "k" integer, "pit_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bulk_update_chunk_embeddings"("payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bulk_update_chunk_embeddings"("payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_chunk_embeddings"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_chunk_embeddings"("payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."anchors" TO "anon";
GRANT ALL ON TABLE "public"."anchors" TO "authenticated";
GRANT ALL ON TABLE "public"."anchors" TO "service_role";



GRANT ALL ON TABLE "public"."bearer_tokens" TO "anon";
GRANT ALL ON TABLE "public"."bearer_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."bearer_tokens" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bearer_tokens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bearer_tokens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bearer_tokens_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chunks" TO "anon";
GRANT ALL ON TABLE "public"."chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."chunks" TO "service_role";



GRANT ALL ON TABLE "public"."citations" TO "anon";
GRANT ALL ON TABLE "public"."citations" TO "authenticated";
GRANT ALL ON TABLE "public"."citations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."citations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."citations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."citations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."definitions" TO "anon";
GRANT ALL ON TABLE "public"."definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."definitions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."definitions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."definitions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."definitions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."docs" TO "anon";
GRANT ALL ON TABLE "public"."docs" TO "authenticated";
GRANT ALL ON TABLE "public"."docs" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_connections" TO "anon";
GRANT ALL ON TABLE "public"."mcp_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_connections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mcp_connections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mcp_connections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mcp_connections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meta" TO "anon";
GRANT ALL ON TABLE "public"."meta" TO "authenticated";
GRANT ALL ON TABLE "public"."meta" TO "service_role";



GRANT ALL ON TABLE "public"."thresholds" TO "anon";
GRANT ALL ON TABLE "public"."thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."thresholds" TO "service_role";



GRANT ALL ON SEQUENCE "public"."thresholds_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thresholds_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thresholds_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."usage_events" TO "anon";
GRANT ALL ON TABLE "public"."usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."usage_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."usage_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."usage_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_facts" TO "anon";
GRANT ALL ON TABLE "public"."user_facts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_facts" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































