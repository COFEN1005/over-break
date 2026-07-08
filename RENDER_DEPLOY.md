# Render Deploy

## Deploy

1. Push this project folder to a GitHub repository.
2. In Render, create a new Web Service from that repository.
3. If Render detects `render.yaml`, use the Blueprint settings.
4. Otherwise set:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/healthz`

## Notes

- The server uses Render's `PORT` environment variable automatically.
- Keep the service at one instance. Matchmaking and battles are currently stored in memory.
- A redeploy, service restart, or free instance sleep will clear active matches.
