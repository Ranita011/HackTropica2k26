# CodeStreak Enforcer

## Local Dummy User

Use this account for local testing after running the seed script in `server`:

- Username: `demouser`
- Email: `demo@codestreak.local`
- Password: `DemoUser123!`
- GitHub username: `octocat`

Login supports either email or username with the same password.

Seed command:

```bash
cd server
npm run seed:dummy
```

The seed script upserts the same user each time, so rerunning it refreshes the account instead of creating duplicates.
