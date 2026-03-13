import postgres from "postgres";

let client: postgres.Sql | null = null;
let schemaPromise: Promise<void> | null = null;

function createClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return postgres(process.env.DATABASE_URL, {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
}

function getClient() {
  if (!client) {
    client = createClient();
  }

  return client;
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureSchema() {
  if (!schemaPromise) {
    const sql = getClient();
    schemaPromise = (async () => {
      await sql`
        create table if not exists securities (
          id text primary key,
          ticker text not null unique,
          company_name text not null,
          sector text not null,
          listing_type text not null,
          listing_date date not null,
          is_active boolean not null default true
        )
      `;
      await sql`
        create table if not exists price_snapshots (
          id text primary key,
          security_id text not null references securities(id) on delete cascade,
          market_date date not null,
          open_price double precision,
          high_price double precision,
          low_price double precision,
          last_price double precision not null,
          previous_close double precision,
          absolute_change double precision not null,
          percent_change double precision not null,
          volume bigint,
          source_name text not null,
          source_reference text not null,
          ingested_at timestamptz not null,
          unique (security_id, market_date)
        )
      `;
      await sql`create index if not exists idx_price_snapshots_security_date on price_snapshots(security_id, market_date desc)`;
      await sql`
        create table if not exists watchlists (
          id text primary key,
          user_id text not null,
          name text not null
        )
      `;
      await sql`
        create table if not exists watchlist_items (
          id text primary key,
          watchlist_id text not null references watchlists(id) on delete cascade,
          security_id text not null references securities(id) on delete cascade,
          unique (watchlist_id, security_id)
        )
      `;
      await sql`
        create table if not exists alerts (
          id text primary key,
          user_id text not null,
          security_id text not null references securities(id) on delete cascade,
          type text not null,
          threshold_value double precision not null,
          channel text not null,
          is_active boolean not null default true,
          last_triggered_at timestamptz
        )
      `;
      await sql`
        create table if not exists notifications (
          id text primary key,
          user_id text not null,
          alert_id text references alerts(id) on delete set null,
          security_id text references securities(id) on delete set null,
          title text not null,
          body text not null,
          channel text not null,
          status text not null,
          created_at timestamptz not null,
          sent_at timestamptz
        )
      `;
      await sql`
        create table if not exists ingestion_runs (
          id text primary key,
          source_name text not null,
          market_date date not null,
          status text not null,
          records_seen integer not null,
          records_inserted integer not null,
          records_updated integer not null,
          records_failed integer not null,
          started_at timestamptz not null,
          completed_at timestamptz,
          error_summary text
        )
      `;
    })();
  }

  return schemaPromise;
}

export async function getSql() {
  return getClient();
}
