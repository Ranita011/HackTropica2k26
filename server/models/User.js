const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    githubUsername: {
      type: String,
      trim: true,
      default: "",
    },
    streak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastCommitDate: {
      type: Date,
      default: null,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    totalFocusTime: {
      type: Number,
      default: 0, // in milliseconds
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
    avatarUrl: {
      type: String,
      default: "",
    },

    // Browser-provided timezone offset in minutes (e.g. UTC-5 => 300)
    // Used to decide what "today" means for GitHub verification.
    timezoneOffsetMinutes: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
