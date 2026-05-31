/**
 * Proxy for the exact neutral ARKit face mesh.
 *
 * The iOS app uploads the real ARSCNFaceGeometry mesh (vertices + triangle indices)
 * to the Day One face API on the droplet. The website renders it 1:1 as a three.js
 * wireframe. Because the droplet only serves HTTP (and the site is HTTPS), we fetch
 * it server-side here to avoid mixed-content blocking, then return it same-origin.
 *
 * Optional override: ARKIT_MESH_UPSTREAM env var.
 */

const UPSTREAM =
  process.env.ARKIT_MESH_UPSTREAM ||
  "http://104.248.137.75:3000/v1/arkit-mesh.json";

export default async function handler(req, res) {
  try {
    const upstream = await fetch(UPSTREAM, { cache: "no-store" });
    if (!upstream.ok) {
      return res
        .status(upstream.status === 404 ? 404 : 502)
        .json({ error: "mesh_unavailable", upstreamStatus: upstream.status });
    }
    const json = await upstream.json();
    // The neutral mesh is static, so cache it aggressively at the edge.
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).send(JSON.stringify(json));
  } catch (err) {
    return res
      .status(502)
      .json({ error: "upstream_fetch_failed", message: String(err?.message || err) });
  }
}
