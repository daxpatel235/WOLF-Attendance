// App-wide constants and palette (backend shares these with the planner/Gemini).
module.exports = {
  APP_NAME: "WOLF Attendance",
  APP_TAGLINE: "Attend the minimum. Stay home the rest.",
  APP_VERSION: "3.0.0",

  // Bring-your-own-key: no key shipped. The user enters their own Gemini API
  // key in Settings (stored locally on their device).
  DEFAULT_API_KEY: "",
  GEMINI_MODELS: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"],

  SUBJECT_PALETTE: [
    "#4A7C59", "#4A6B8A", "#C49A3C", "#C4704F", "#7C6F58", "#5A7A6A",
    "#8A6D5A", "#6A5A7A", "#4F6F8A", "#8A8246", "#A94438", "#6B6560",
  ],

  // Labs are weighted higher and use a stricter default %.
  LAB_WEIGHT: 3,
  DEFAULT_LAB_PERCENT: 75,
  INSTITUTION_TYPES: ["College", "School", "University", "Coaching / Institute"],
};
