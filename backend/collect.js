require("./env");
const { pool, migrate } = require("./db");
const { getStoreDeals } = require("./flipp");

const STORE_NAMES = ["No Frills", "T&T Supermarket", "FreshCo", "Loblaws", "Costco"];
const EVERY_12_HOURS = 12 * 60 * 60 * 1000;

function postalCodesToCollect() {
  return (process.env.COLLECT_POSTAL_CODES || "L3R3G7")
    .split(",")
    .map((code) => code.trim().replace(/[ -]/g, "").toUpperCase())
    .filter(Boolean);
}

async function saveStore(client, postalCode, { flyers, deals }) {
  for (const f of flyers) {
    await client.query(
      `insert into flyers (id, store, valid_from, valid_to, is_grocery)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         valid_from = excluded.valid_from,
         valid_to = excluded.valid_to,
         is_grocery = excluded.is_grocery`,
      [
        f.id,
        f.merchant,
        f.valid_from,
        f.valid_to,
        (f.categories || []).includes("Groceries"),
      ]
    );
    await client.query(
      `insert into flyer_regions (flyer_id, postal_code) values ($1, $2)
       on conflict do nothing`,
      [f.id, postalCode]
    );
  }

  // the same item can show up in two flyers, postgres wont upsert a row twice in one insert
  const unique = [...new Map(deals.map((d) => [d.id, d])).values()];
  const flyerById = new Map(flyers.map((f) => [f.id, f]));
  const col = (fn) => unique.map(fn);

  await client.query(
    `insert into prices
       (flipp_item_id, flyer_id, store, name, category, price, image_url, valid_from, valid_to)
     select * from unnest(
       $1::bigint[], $2::bigint[], $3::text[], $4::text[], $5::text[],
       $6::numeric[], $7::text[], $8::timestamptz[], $9::timestamptz[]
     )
     on conflict (flipp_item_id) do update set
       name = excluded.name,
       category = excluded.category,
       price = excluded.price,
       image_url = excluded.image_url,
       collected_at = now()`,
    [
      col((d) => d.id),
      col((d) => d.flyer_id),
      col((d) => flyerById.get(d.flyer_id)?.merchant),
      col((d) => d.name || ""),
      col((d) => d.category),
      col((d) => Number(d.price)),
      col((d) => d.cutout_image_url || null),
      col((d) => d.valid_from || flyerById.get(d.flyer_id)?.valid_from),
      col((d) => d.valid_to || flyerById.get(d.flyer_id)?.valid_to),
    ]
  );

  return { flyers: flyers.length, prices: unique.length };
}

async function collectPostalCode(postalCode) {
  const run = await pool.query(
    "insert into collection_runs (postal_code) values ($1) returning id",
    [postalCode]
  );
  const runId = run.rows[0].id;
  let flyersSaved = 0;
  let pricesSaved = 0;
  const failed = [];

  try {
    for (const store of STORE_NAMES) {
      let result;
      try {
        result = await getStoreDeals(store, postalCode);
      } catch (error) {
        console.log(`collect: couldn't load ${store}:`, error.message);
        failed.push(store);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        const saved = await saveStore(client, postalCode, result);
        await client.query("commit");
        flyersSaved += saved.flyers;
        pricesSaved += saved.prices;
      } catch (error) {
        await client.query("rollback");
        console.log(`collect: couldn't save ${store}:`, error.message);
        failed.push(store);
      } finally {
        client.release();
      }
    }
    await pool.query(
      `update collection_runs set finished_at = now(), flyers_saved = $2,
         prices_saved = $3, failed_stores = $4 where id = $1`,
      [runId, flyersSaved, pricesSaved, failed]
    );
    console.log(
      `collect: ${postalCode} saved ${pricesSaved} prices from ${flyersSaved} flyers` +
        (failed.length ? `, failed: ${failed.join(", ")}` : "")
    );
  } catch (error) {
    await pool.query(
      "update collection_runs set finished_at = now(), error = $2 where id = $1",
      [runId, error.message]
    );
    throw error;
  }
}

async function collectAll() {
  for (const postalCode of postalCodesToCollect()) {
    await collectPostalCode(postalCode);
  }
}

// runs once on startup then every 12 hours, saving the same flyer twice just updates it
function startCollector() {
  if (!pool) return;
  const run = () =>
    collectAll().catch((error) => console.log("collect failed:", error.message));
  setTimeout(run, 5000).unref();
  setInterval(run, EVERY_12_HOURS).unref();
}

module.exports = { collectAll, startCollector };

if (require.main === module) {
  if (!pool) {
    console.log("set DATABASE_URL first");
    process.exit(1);
  }
  migrate()
    .then(collectAll)
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
