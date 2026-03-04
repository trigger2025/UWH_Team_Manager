import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Pencil } from "lucide-react";
import { Player, AttendanceTracking, PoolTracking, DEFAULT_ATTENDANCE_TRACKING, DEFAULT_POOL_TRACKING } from "@shared/schema";

type Tab = "attendance" | "pool";

function getAttendance(player: Player): AttendanceTracking {
  const at = player.attendanceTracking as any;
  if (!at || typeof at !== "object") return { ...DEFAULT_ATTENDANCE_TRACKING };
  return { ...DEFAULT_ATTENDANCE_TRACKING, ...at };
}

function getPoolTracking(player: Player): PoolTracking {
  const pt = player.poolTracking as any;
  if (!pt || typeof pt !== "object") return { ...DEFAULT_POOL_TRACKING };
  return { ...DEFAULT_POOL_TRACKING, ...pt };
}

function hasSoWedsTag(player: Player): boolean {
  return (player.tags || []).some(t => t.trim().toLowerCase() === "so weds");
}

type Priority = "EXEMPT" | "HIGH" | "MEDIUM" | "NORMAL";

function getPriority(player: Player, at: AttendanceTracking): Priority {
  if (hasSoWedsTag(player)) return "EXEMPT";
  if (
    at.sessionsSinceLastAllowed >= 3 ||
    (at.sessionsDeniedCount - at.sessionsAllowedCount) >= 2
  ) return "HIGH";
  if (at.sessionsSinceLastAllowed === 2) return "MEDIUM";
  return "NORMAL";
}

function priorityBadge(p: Priority) {
  switch (p) {
    case "EXEMPT": return <Badge className="text-[9px] bg-muted/40 text-muted-foreground border-muted-foreground/30">EXEMPT</Badge>;
    case "HIGH":   return <Badge className="text-[9px] bg-red-500/20 text-red-400 border-red-500/30">HIGH</Badge>;
    case "MEDIUM": return <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30">MEDIUM</Badge>;
    case "NORMAL": return <Badge className="text-[9px] bg-green-500/20 text-green-400 border-green-500/30">NORMAL</Badge>;
  }
}

function poolSuggestions(pt: PoolTracking): string[] {
  const hints: string[] = [];
  if (pt.sessionsSinceLastAPool >= 3) hints.push("Consider A Pool");
  if (pt.sessionsSinceLastBPool >= 3) hints.push("Consider B Pool");
  if (pt.timesInAPool - pt.timesInBPool >= 3) hints.push("Heavy A exposure");
  if (pt.timesInBPool - pt.timesInAPool >= 3) hints.push("Heavy B exposure");
  return hints;
}

interface EditModalState {
  playerId: number;
  playerName: string;
  attendance: AttendanceTracking;
  pool: PoolTracking;
}

export default function RotationPage() {
  const { players, markAttendanceAllowed, markAttendanceDenied, recordPoolPlay, updateRotationCounters } = useApp();
  const [tab, setTab] = useState<Tab>("attendance");
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

  const activePlayers = players.filter(p => p.active).sort((a, b) => a.name.localeCompare(b.name));

  function openEdit(player: Player) {
    setEditModal({
      playerId: player.id,
      playerName: player.name,
      attendance: getAttendance(player),
      pool: getPoolTracking(player),
    });
  }

  function saveEdit() {
    if (!editModal) return;
    updateRotationCounters(editModal.playerId, editModal.attendance, editModal.pool);
    setEditModal(null);
  }

  function patchAttendance(key: keyof AttendanceTracking, value: number) {
    if (!editModal) return;
    setEditModal(prev => prev ? {
      ...prev,
      attendance: { ...prev.attendance, [key]: value },
    } : null);
  }

  function patchPool(key: keyof PoolTracking, value: number) {
    if (!editModal) return;
    setEditModal(prev => prev ? {
      ...prev,
      pool: { ...prev.pool, [key]: value },
    } : null);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">Rotation</h1>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
          <button
            onClick={() => setTab("attendance")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "attendance" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            data-testid="tab-attendance"
          >
            Attendance
          </button>
          <button
            onClick={() => setTab("pool")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "pool" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            data-testid="tab-pool"
          >
            Pool Rotation
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-2">
        {activePlayers.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No active players found.</p>
        )}

        {tab === "attendance" && activePlayers.map(player => {
          const at = getAttendance(player);
          const priority = getPriority(player, at);
          return (
            <Card key={player.id} className="border-border/50">
              <CardContent className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{player.name}</span>
                    {priorityBadge(priority)}
                  </div>
                  <button
                    onClick={() => openEdit(player)}
                    className="text-muted-foreground/50 hover:text-foreground shrink-0 transition-colors"
                    data-testid={`button-edit-counters-${player.id}`}
                    aria-label="Edit counters"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-1 mb-3 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Allowed</div>
                    <div className="text-sm font-bold text-green-400" data-testid={`text-allowed-count-${player.id}`}>{at.sessionsAllowedCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Denied</div>
                    <div className="text-sm font-bold text-red-400" data-testid={`text-denied-count-${player.id}`}>{at.sessionsDeniedCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Since ✓</div>
                    <div className="text-sm font-bold" data-testid={`text-since-allowed-${player.id}`}>{at.sessionsSinceLastAllowed}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Since ✗</div>
                    <div className="text-sm font-bold" data-testid={`text-since-denied-${player.id}`}>{at.sessionsSinceLastDenied}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    onClick={() => markAttendanceAllowed(player.id)}
                    data-testid={`button-allowed-${player.id}`}
                  >
                    ✓ Mark Allowed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => markAttendanceDenied(player.id)}
                    data-testid={`button-denied-${player.id}`}
                  >
                    ✗ Mark Denied
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {tab === "pool" && activePlayers.map(player => {
          const pt = getPoolTracking(player);
          const hints = poolSuggestions(pt);
          return (
            <Card key={player.id} className="border-border/50">
              <CardContent className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-medium text-sm truncate">{player.name}</span>
                  <button
                    onClick={() => openEdit(player)}
                    className="text-muted-foreground/50 hover:text-foreground shrink-0 transition-colors"
                    data-testid={`button-edit-pool-${player.id}`}
                    aria-label="Edit counters"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-1 mb-2 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground">A Count</div>
                    <div className="text-sm font-bold text-amber-400" data-testid={`text-a-count-${player.id}`}>{pt.timesInAPool}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">B Count</div>
                    <div className="text-sm font-bold text-violet-400" data-testid={`text-b-count-${player.id}`}>{pt.timesInBPool}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Since A</div>
                    <div className="text-sm font-bold" data-testid={`text-since-a-${player.id}`}>{pt.sessionsSinceLastAPool}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Since B</div>
                    <div className="text-sm font-bold" data-testid={`text-since-b-${player.id}`}>{pt.sessionsSinceLastBPool}</div>
                  </div>
                </div>

                {/* Suggestions */}
                {hints.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {hints.map(hint => (
                      <span key={hint} className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                        {hint}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => recordPoolPlay(player.id, "A")}
                    data-testid={`button-played-a-${player.id}`}
                  >
                    Played A
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                    onClick={() => recordPoolPlay(player.id, "B")}
                    data-testid={`button-played-b-${player.id}`}
                  >
                    Played B
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Counters Modal */}
      {editModal && (
        <Dialog open onOpenChange={() => setEditModal(null)}>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Counters — {editModal.playerName}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Manually adjust attendance and pool rotation counters.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Attendance</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["sessionsAllowedCount", "Allowed Count"],
                    ["sessionsDeniedCount", "Denied Count"],
                    ["sessionsSinceLastAllowed", "Since Allowed"],
                    ["sessionsSinceLastDenied", "Since Denied"],
                  ] as [keyof AttendanceTracking, string][]).map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-[10px] text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editModal.attendance[key] as number}
                        onChange={e => patchAttendance(key, Math.max(0, parseInt(e.target.value) || 0))}
                        className="h-8 text-sm text-center"
                        data-testid={`input-edit-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Pool Rotation</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["timesInAPool", "A Pool Count"],
                    ["timesInBPool", "B Pool Count"],
                    ["sessionsSinceLastAPool", "Since A"],
                    ["sessionsSinceLastBPool", "Since B"],
                  ] as [keyof PoolTracking, string][]).map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-[10px] text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editModal.pool[key]}
                        onChange={e => patchPool(key, Math.max(0, parseInt(e.target.value) || 0))}
                        className="h-8 text-sm text-center"
                        data-testid={`input-edit-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setEditModal(null)}>Cancel</Button>
              <Button size="sm" onClick={saveEdit} data-testid="button-save-counters">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <BottomNav />
    </div>
  );
}
