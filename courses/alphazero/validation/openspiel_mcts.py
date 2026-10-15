"""Cross-check of the course's pure MCTS against OpenSpiel's, same protocol.

OpenSpiel (DeepMind) is an independent implementation. Its MCTSBot with
SearchNode.puct_value uses the same rule as the course: Q + c·P·√N / (1 + n),
Q = 0 for an unvisited child, a uniform prior, one random rollout per leaf,
the most visited move. MCTS-Solver is switched off (solve=False).

For each number of simulations, 100 games against a perfect player (who picks
at random among its minimax-optimal moves), 50 as X and 50 as O. Prints the
losses and their Wilson 95 % interval as JSON.

    python -m venv venv && ./venv/bin/pip install open_spiel
    ./venv/bin/python validation/openspiel_mcts.py > validation/openspiel.json
"""

import json
import math
import random
import sys

import numpy as np
import pyspiel
from open_spiel.python.algorithms import get_all_states, mcts

GAME = pyspiel.load_game("tic_tac_toe")
GAMES = 100
_memo = {}


def value(state):
  """Minimax value for the player to move: 1, 0 or -1."""
  key = str(state)
  if key in _memo:
    return _memo[key]
  if state.is_terminal():
    r = state.returns()
    # the player who would move next lost if the last mover won
    v = 0 if r[0] == 0 else -1
  else:
    v = max(-value(state.child(a)) for a in state.legal_actions())
  _memo[key] = v
  return v


def perfect(state, rng):
  v = value(state)
  best = [a for a in state.legal_actions() if -value(state.child(a)) == v]
  return rng.choice(best)


def wilson(k, n, z=1.96):
  p = k / n
  d = 1 + z * z / n
  c = (p + z * z / (2 * n)) / d
  h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
  return [max(0.0, c - h), min(1.0, c + h)]


def puct_az(node, parent_explore_count, uct_c):
  """AlphaZero's rule for every child, finished games included (OpenSpiel's
  puct_value scores a finished game by its exact outcome, with no exploration
  bonus: with a large c, an immediate win is then visited only once)."""
  q = node.explore_count and node.total_reward / node.explore_count
  return q + uct_c * node.prior * math.sqrt(parent_explore_count) / (node.explore_count + 1)


def losses(sims, c, seed, rule=mcts.SearchNode.puct_value):
  rng = random.Random(seed)
  bot = mcts.MCTSBot(GAME, c, sims, mcts.RandomRolloutEvaluator(1, np.random.RandomState(seed)),
                     solve=False, random_state=np.random.RandomState(seed),
                     child_selection_fn=rule)
  lost = 0
  for g in range(GAMES):
    side = g % 2  # the bot plays X (player 0) on even games
    state = GAME.new_initial_state()
    while not state.is_terminal():
      a = bot.step(state) if state.current_player() == side else perfect(state, rng)
      state.apply_action(a)
    if state.returns()[side] < 0:
      lost += 1
  return lost


def main():
  sims_grid = [int(x) for x in (sys.argv[1].split(",") if len(sys.argv) > 1 else "10,25,50,100,200,400,800,1200,1600,3200".split(","))]
  c_grid = [0, 0.1, 0.5, 5, 25, 100]
  counts = {"states": len(get_all_states.get_all_states(GAME, -1, True, False)),
            "root_value": value(GAME.new_initial_state())}
  rows = []
  for s in sims_grid:
    k = losses(s, 5, 7, puct_az)
    rows.append({"sims": s, "c": 5, "rule": "alphazero", "losses": k, "ci": wilson(k, GAMES)})
  for c in c_grid:
    k = losses(1600, c, 7)
    rows.append({"sims": 1600, "c": c, "losses": k, "ci": wilson(k, GAMES)})
  for c in [0, 0.1, 0.5, 1.5, 3, 10, 25, 50, 100]:
    k = losses(1600, c, 7, puct_az)
    rows.append({"sims": 1600, "c": c, "rule": "alphazero", "losses": k, "ci": wilson(k, GAMES)})
  print(json.dumps({"games": GAMES, "checks": counts, "rows": rows}, indent=1))


if __name__ == "__main__":
  main()
