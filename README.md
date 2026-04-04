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

## GitHub OAuth Setup (One-Time Connect Per User)

Users can connect GitHub once from the dashboard, then use **Verify today** without re-entering credentials.

1. Create a GitHub OAuth App in your GitHub account settings.
2. Set the app callback URL to your backend callback endpoint.

Example callback URL (local):

```bash
http://localhost:5000/api/github/oauth/callback
```

Set these values in `server/.env`:

```bash
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:5000/api/github/oauth/callback
```

Restart the backend after updating `.env`.
