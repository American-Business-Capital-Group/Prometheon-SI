"""Gateway helper: one bounded Lampas SI recursion for a user task.

Runs core.run_mission against the DEDICATED Lampas Fence (127.0.0.1:8798,
max_depth 3, its own ledger) exactly as lampas_proof.py does - env is set
BEFORE core is imported - but with the caller's task instead of the fixed
proof task. fanout=0 at every level: each Atomizer decides solve-vs-spawn
on its own judgment inside Fence budget/depth policy (P2/P4 semantics).
Writes a JSON summary to --out and prints one line.
"""
import argparse
import json
import os

os.environ["PROMETHEON_FENCE_URL"] = "http://127.0.0.1:8798"
os.environ["PROMETHEON_CORE_MAX_DEPTH"] = "3"
os.environ["PROMETHEON_CHILD_FANOUT"] = "0"

import core  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", required=True)
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    out = core.run_mission(args.run_id, "lampas", args.task, fanout=0)
    agents = out["tree"]["agents"]
    rec = {
        "run_id": args.run_id, "track": "Lampas SI",
        "seconds": out["seconds"], "agent_count": len(agents),
        "max_depth_reached": max((a["depth"] for a in agents.values()),
                                 default=0),
        "agents": {
            aid: {"parent": a["parent_id"], "depth": a["depth"],
                  "brain": a["brain_api_id"], "route": a["brain_route"],
                  "status": a["status"], "tokens": a["tokens_used"],
                  "grant_id": a["grant_id"]}
            for aid, a in agents.items()
        },
        "run_tokens": out["tree"]["tokens_debited"],
        "run_budget": out["tree"]["budget_tokens"],
        "trace_id": out.get("trace_id"),
        "result": out["result"],
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(rec, f, indent=2)
    print(f"LAMPAS GATEWAY RUN {args.run_id}: agents={rec['agent_count']} "
          f"max_depth={rec['max_depth_reached']} tokens={rec['run_tokens']}")


if __name__ == "__main__":
    main()
