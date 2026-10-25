# NAANsense v2 🫓 — The Flatbread Adventure

A responsive real-time multiplayer game blending naan trivia, a light bread adventure, and gluten-free kitchen challenges. Built with Node.js, Express, and Socket.IO.

## Gameplay rules
- **2–8 players** join a room using a six-character code.
- The host starts once at least two players have joined.
- Six timed rounds cover flour facts, gluten-free ingredients, label reading, and kitchen cross-contact awareness.
- Each round has one correct answer and an 18-second timer.
- Correct answers earn 100 points plus up to 50 speed bonus points.
- Players may answer once per round. The game reveals the correct answer and a short learning fact after everyone answers or time expires.
- Highest total score after round six wins.
- Badge labels are awarded for correct answers in each round category.

## Run locally
Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. For testing across devices on the same Wi-Fi, use the host computer's LAN IP and port 3000. For people in different places, deploy publicly as below.

## Deploy publicly on Render
1. Create a GitHub repository and upload the contents of this folder.
2. Sign in to Render and create **New → Web Service** connected to the repository.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Deploy. Render supplies a public HTTPS URL. Share it with players; one player creates a room and sends the code to the others.

The frontend and Socket.IO backend are served from one origin. No separate frontend URL is needed. Free instances may sleep when idle; the first connection after inactivity can take longer.

## Food and health note
Traditional naan is usually made with wheat flour and contains gluten. Rice and chickpea flour are naturally gluten-free ingredients, but packaged products and kitchen preparation can involve cross-contact. People who must avoid gluten, including people with celiac disease, should check labels and ask about preparation practices. The game is for general education, not medical advice.

## Technical notes
- Game rooms are stored in server memory; restarting or redeploying the service ends active rooms.
- Names and scores are temporary; there are no accounts, persistent profiles, or chat.
- Do not open `public/index.html` as a local file; run the Node server.
