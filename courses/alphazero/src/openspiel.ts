// Results of OpenSpiel (DeepMind), an independent implementation of MCTS,
// with the course's protocol: 100 games against the perfect player, half as X.
// Generated from validation/openspiel.json (validation/openspiel_mcts.py); the
// model checks that its own results agree within the 95 % intervals.

export const OPENSPIEL = {
  games: 100,
  /** nodes of the whole game tree, and the value of the empty board */
  nodes: 549946, rootValue: 0,
  /** c = 5, AlphaZero's rule (the course's) */
  bySims: [
    { sims: 10, losses: 69 },
    { sims: 25, losses: 53 },
    { sims: 50, losses: 39 },
    { sims: 100, losses: 27 },
    { sims: 200, losses: 18 },
    { sims: 400, losses: 10 },
    { sims: 800, losses: 1 },
    { sims: 1200, losses: 1 },
    { sims: 1600, losses: 0 },
    { sims: 3200, losses: 0 },
  ],
  /** 1 600 simulations, AlphaZero's rule */
  byC: [
    { c: 0, losses: 51 },
    { c: 0.1, losses: 19 },
    { c: 0.5, losses: 15 },
    { c: 1.5, losses: 4 },
    { c: 3, losses: 2 },
    { c: 10, losses: 0 },
    { c: 25, losses: 0 },
    { c: 50, losses: 9 },
    { c: 100, losses: 17 },
  ],
  /** 1 600 simulations, OpenSpiel's own rule (a finished game is scored without exploration bonus) */
  byCOpenSpielRule: [
    { c: 0, losses: 51 },
    { c: 0.1, losses: 19 },
    { c: 0.5, losses: 12 },
    { c: 5, losses: 0 },
    { c: 25, losses: 10 },
    { c: 100, losses: 66 },
  ],
};
