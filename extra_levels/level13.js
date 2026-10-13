// Saved from the level builder. Same fields as the tables in src/levels.js.
export const level = {
  "id": 13,
  "name": "Level 13",
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
      "x": 230.99,
      "y": 270.18,
      "part": "ball",
      "role": "hero"
    },
    {
      "shape": "box",
      "x": 658.9,
      "y": 332.23,
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
      "x": 650.84,
      "y": 374.14,
      "part": "board"
    },
    {
      "x": 757.22,
      "y": 276.63,
      "angle": 1.57,
      "part": "board"
    },
    {
      "x": 462.27,
      "y": 131.58,
      "angle": 1.57,
      "part": "board"
    }
  ],
  "decors": [],
  "inventory": [
    {
      "type": "seesaw",
      "count": 1
    },
    {
      "type": "weight",
      "count": 1
    },
    {
      "type": "candle",
      "count": 1
    },
    {
      "type": "board",
      "count": 2
    },
    {
      "type": "spring",
      "count": 2
    },
    {
      "type": "rope",
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
      "type": "seesaw",
      "x": 176.19,
      "y": 467.62
    },
    {
      "type": "weight",
      "x": 73.04,
      "y": 266.96
    },
    {
      "type": "candle",
      "x": 152.01,
      "y": 225.05
    },
    {
      "type": "board",
      "x": 123,
      "y": 71.14
    },
    {
      "type": "spring",
      "x": 444.54,
      "y": 498.24
    },
    {
      "type": "spring",
      "x": 519.49,
      "y": 499.05
    },
    {
      "type": "board",
      "x": 649.23,
      "y": 107.4,
      "angle": 0.79
    }
  ],
  "time": 12
};
