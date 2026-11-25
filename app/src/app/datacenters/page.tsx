const REGIONS = [
  {
    name: "North America",
    body: "The largest share of the footprint: routing, serving, and agent infrastructure close to the US customer base.",
  },
  {
    name: "Europe",
    body: "European locations serving the aggregate's vendor routes and regional workloads.",
  },
  {
    name: "Asia-Pacific",
    body: "Asia-Pacific locations rounding out the global routing map for latency-sensitive work.",
  },
  {
    name: "Worldwide",
    body: "The footprint is presented as a global map: markers show approximate city and regional locations rather than street-level facility addresses.",
  },
];

export default function DatacentersPage() {
  return (
    <>
      <h1>Our Data Centers</h1>
      <p className="lede" style={{ fontSize: "1.15rem", color: "var(--chrome-light)" }}>
        Explore data center locations around the world
      </p>
      <h2>A global perspective.</h2>
      <div className="grid">
        <div className="card">
          <p className="price">57 locations</p>
          <p>
            The Prometheon SI infrastructure footprint spans 57 locations
            worldwide — the map behind the aggregate's routing, the agent
            platforms, and the society's world state.
          </p>
        </div>
        {REGIONS.map((r) => (
          <div className="card" key={r.name}>
            <h3>{r.name}</h3>
            <p>{r.body}</p>
          </div>
        ))}
      </div>
      <p className="muted">
        Markers show approximate city and regional locations. Location
        research updated September 25, 2026. Information may change.
      </p>
    </>
  );
}
