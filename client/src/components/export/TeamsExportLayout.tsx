export interface ExportPlayer {
  name: string;
  position?: string;
  rating?: number;
}

export interface ExportTeamData {
  name: string;
  avg: number;
  color?: "Black" | "White" | string;
  players: ExportPlayer[];
}

export interface ExportSectionData {
  label?: string;
  teams: ExportTeamData[];
}

interface Props {
  sections: ExportSectionData[];
  includeRatings: boolean;
  includePositions: boolean;
  title?: string;
}

const DARK = "#0a0f1e";
const CARD = "#111827";
const BORDER = "#1e3a5f";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const BLACK_ACCENT = "#3b82f6";
const WHITE_ACCENT = "#22d3ee";
const OTHER_ACCENT = "#f59e0b";

function teamAccent(color?: string): string {
  if (color === "Black") return BLACK_ACCENT;
  if (color === "White") return WHITE_ACCENT;
  return OTHER_ACCENT;
}

export default function TeamsExportLayout({ sections, includeRatings, includePositions, title = "Generated Teams" }: Props) {
  return (
    <div style={{ width: 1000, background: DARK, padding: 32, fontFamily: "system-ui, -apple-system, sans-serif", color: TEXT, boxSizing: "border-box" }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: TEXT, letterSpacing: "-0.02em" }}>
        {title}
      </div>

      {sections.map((section, si) => (
        <div key={si} style={{ marginBottom: si < sections.length - 1 ? 32 : 0 }}>
          {section.label && (
            <div style={{ fontSize: 13, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              {section.label}
            </div>
          )}
          <div style={{ display: "flex", gap: 16, flexWrap: section.teams.length > 3 ? "wrap" : "nowrap" }}>
            {section.teams.map((team, ti) => {
              const accent = teamAccent(team.color);
              const avgRating = team.avg;
              return (
                <div
                  key={ti}
                  style={{
                    flex: "1 1 0",
                    minWidth: section.teams.length > 3 ? "calc(33% - 12px)" : 0,
                    background: CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: accent }}>{team.name}</span>
                    </div>
                    {includeRatings && (
                      <span style={{ fontSize: 11, color: MUTED, background: "#1e293b", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2px 8px" }}>
                        Avg {avgRating}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: "8px 0" }}>
                    {team.players.map((player, pi) => (
                      <div
                        key={pi}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 16px",
                          borderBottom: pi < team.players.length - 1 ? `1px solid ${BORDER}40` : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", width: 20, flexShrink: 0 }}>#{pi + 1}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {player.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {includePositions && player.position && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, background: "#1e293b", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {player.position}
                            </span>
                          )}
                          {includeRatings && player.rating !== undefined && (
                            <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
                              {player.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
