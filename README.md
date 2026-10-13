# Contraption

A contraption puzzle in the spirit of Rube Goldberg machines. Parts stay where you nail them, loose pieces tumble, and the fun is the chain reaction in between.

## Play

```bash
npm start
```

Open [http://localhost:8080](http://localhost:8080).

Find the process that is listening:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

Stop it with the pid from that listing, or with:

```bash
npm stop
```

`npm stop` locates whatever is listening on port 8080 and stops it. For another port, use `PORT=3000 npm stop` and the same port in the `lsof` command.

Drag parts from the shelf onto the felt. Scroll, or press Q and E, to rotate. Press Play and see whether the machine does the job. Stop puts every part back where you set it. Hint ghosts one layout that works; it is not the only one.

Build opens an empty table with every part, plus Start and End. Click Build again to return to the machines. Fixed parts are stored in the level. Player parts are given to the player, and the spots you chose are saved as the solution. Save level writes `extra_levels/level12.js`, then `level13.js`, and so on. Load lists those files and opens one back in the builder. Each file uses the same fields as the tables in `src/levels.js`.

## Tables

1. A Rolling Start — one board, one ball, one basket
2. Across the Gap — bridge a pit
3. Boing — aim a spring out of a shaft
4. Crosswind — blow a balloon into a hoop
5. Tip the Line — finish a domino row
6. Burn Notice — candles and rope
7. Scamp's Errand — a creature that only walks
8. Moving Day — a conveyor and a bridge
9. The Heavy Idea — a loaded seesaw and a decoy rope
10. Catch of the Day — cut the rope and catch what falls
11. Open Bench — the whole toy box

## Checks

```bash
npm test
```

The physics tests and a scripted solution for every table run in Node.
