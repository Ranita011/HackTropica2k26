require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

const DUMMY_USER = {
  username: "demouser",
  email: "demo@codestreak.local",
  password: "DemoUser123!",
  githubUsername: "octocat",
  streak: 7,
  longestStreak: 12,
  totalFocusTime: 4 * 60 * 60 * 1000,
  totalSessions: 18,
  avatarUrl: "https://github.com/octocat.png",
  timezoneOffsetMinutes: new Date().getTimezoneOffset(),
};

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is not set");
  }

  await mongoose.connect(mongoUri);

  const hashedPassword = await bcrypt.hash(DUMMY_USER.password, 10);
  const user = await User.findOneAndUpdate(
    { email: DUMMY_USER.email },
    {
      ...DUMMY_USER,
      password: hashedPassword,
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log("Dummy user ready:");
  console.log(JSON.stringify({
    username: user.username,
    email: user.email,
    password: DUMMY_USER.password,
    githubUsername: user.githubUsername,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
