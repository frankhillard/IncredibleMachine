// Saved from the level builder. Same fields as the tables in src/levels.js.
export const level = {
  "id": 14,
  "name": "Level 14",
  "hint": "Bring the ball to the end.",
  "fixtures": [
    {
      "shape": "box",
      "x": 8,
      "y": 270,
      "static": true,
      "w": 16,
      "h": 540,
      "style": "frame",
      "friction": 0.45,
      "restitution": 0.04
    },
    {
      "shape": "box",
      "x": 952,
      "y": 270,
      "static": true,
      "w": 16,
      "h": 540,
      "style": "frame",
      "friction": 0.45,
      "restitution": 0.04
    },
    {
      "shape": "box",
      "x": 480,
      "y": 8,
      "static": true,
      "w": 960,
      "h": 16,
      "style": "frame",
      "friction": 0.3,
      "restitution": 0.04
    },
    {
      "shape": "box",
      "x": 480,
      "y": 1100,
      "static": true,
      "w": 2200,
      "h": 120,
      "style": "frame",
      "friction": 0.7,
      "restitution": 0.04
    },
    {
      "x": 150.96,
      "y": 140.37,
      "part": "ball",
      "role": "hero"
    },
    {
      "shape": "box",
      "x": 686.8,
      "y": 234.14,
      "static": true,
      "w": 180,
      "h": 64,
      "sensor": true,
      "role": "goal",
      "style": "sensor",
      "friction": 0.4,
      "restitution": 0.1
    },
    {
      "x": 351.9,
      "y": 193.95,
      "part": "board"
    }
  ],
  "decors": [],
  "inventory": [
    {
      "type": "spring",
      "count": 1
    }
  ],
  "goal": {
    "type": "contain",
    "match": "ball",
    "zone": "goal",
    "mode": "any",
    "hold": 0.3,
    "maxSpeed": 360
  },
  "solution": [
    {
      "type": "spring",
      "x": 351.9,
      "y": 341.31
    }
  ],
  "time": 12
};
