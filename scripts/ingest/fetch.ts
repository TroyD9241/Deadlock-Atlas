/**
 * Fetch the Deadlock API assets group into data/raw/ (Plan section 3).
 *
 * This is the only thing in the project that talks to the API. It writes raw
 * responses and nothing else: no database access, no normalisation. That
 * split is deliberate, so an API change cannot corrupt stored data.
 *
 * Usage:
 *   npx tsx scripts/ingest/fetch.ts                    # newest build
 *   npx tsx scripts/ingest/fetch.ts --build 6793       # a specific build
 *   npx tsx scripts/ingest/fetch.ts --list             # endpoint names only
 *
 * `--build` matters for the patch history. The API serves an older build's
 * assets as well as the current one's, and diffing two builds is how the
 * site knows what a patch changed. The builds are sparse, not contiguous —
 * 6820 and 6816 do not exist — so a build that 404s is not a build.
 */
import { endpointNames, sweepAssets } from "./api";

async function main() {
  if (process.argv.includes("--list")) {
    for (const n of endpointNames()) console.log(n);
    return;
  }

  /*
   * `--build <n>` targets a specific build. The flag is read by hand
   * because the argument list is positional otherwise, and a bare
   * `--build` with no number is a mistake worth catching rather than
   * defaulting to the newest build.
   */
  let build: number | undefined;
  const buildFlag = process.argv.indexOf("--build");
  if (buildFlag >= 0) {
    const value = Number(process.argv[buildFlag + 1]);
    if (!Number.isInteger(value) || value <= 0) {
      console.error("--build needs a build number, e.g. --build 6793");
      process.exit(1);
    }
    build = value;
  }

  const sweep = await sweepAssets({
    clientVersion: build,
    onResult: (r) => {
      const status = r.status === 200 ? "ok  " : `FAIL ${r.status}`;
      const rows = r.rows === null ? "-" : `${r.rows} rows`;
      const size =
        r.bytes > 1_000_000
          ? `${(r.bytes / 1_048_576).toFixed(1)}MB`
          : `${Math.round(r.bytes / 1024)}KB`;
      console.log(
        `  ${status}  ${r.name.padEnd(24)} ${rows.padStart(10)}  ${size.padStart(8)}  ${
          r.cached ? `saved ${r.cached}` : r.error ? r.error : "not cached"
        }`,
      );
    },
  });

  const cached = sweep.results.filter((r) => r.cached).length;
  const failed = sweep.results.filter((r) => r.status !== 200);

  console.log("");
  console.log(`build ${sweep.clientVersion} of ${sweep.totalBuilds} known builds`);
  console.log(
    `${sweep.results.length} endpoints: ${sweep.results.length - failed.length} reachable, ${failed.length} failed, ${cached} cached`,
  );
  console.log(`raw responses in ${sweep.directory}/`);

  if (failed.length) {
    console.log("");
    console.log("unreachable:");
    for (const f of failed) console.log(`  ${f.name}  ${f.error}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});