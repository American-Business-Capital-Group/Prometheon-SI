"use client";

/**
 * The AI Civilization world view, embedded from the self-contained static
 * module in public/world/ (CesiumJS vendored locally; same module ships
 * standalone at aicivilization.si). The iframe keeps the module identical
 * across both front doors.
 */
export default function WorldEmbed() {
  return (
    <div className="world-embed">
      <iframe
        src="/world/world-embed.html"
        title="AI Civilization — live world view: District 1, Chicago Loop, on the real Earth"
        loading="lazy"
      />
    </div>
  );
}
