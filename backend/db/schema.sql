create table if not exists flyers (
  id bigint primary key,
  store text not null,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  is_grocery boolean not null default true,
  first_seen timestamptz not null default now()
);

-- the same flyer covers lots of postal codes, this tracks which ones we saw it for
create table if not exists flyer_regions (
  flyer_id bigint not null references flyers (id) on delete cascade,
  postal_code text not null,
  primary key (flyer_id, postal_code)
);

create table if not exists prices (
  flipp_item_id bigint primary key,
  flyer_id bigint not null references flyers (id) on delete cascade,
  store text not null,
  name text not null,
  category text not null,
  price numeric(8, 2) not null,
  image_url text,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  collected_at timestamptz not null default now()
);

create index if not exists prices_store_week on prices (store, valid_from);
create index if not exists prices_category on prices (category);
create index if not exists flyer_regions_postal on flyer_regions (postal_code);

create table if not exists collection_runs (
  id serial primary key,
  postal_code text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  flyers_saved int,
  prices_saved int,
  failed_stores text[],
  error text
);
