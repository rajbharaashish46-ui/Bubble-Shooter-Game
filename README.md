# Bubble Arcade Classic

A modern, native Web application implementation of the classic Bubble Shooter game, built entirely with vanilla HTML, CSS, and JavaScript. Zero external libraries/dependencies required.

## Features
- **Match-3 Mechanics**: Shoot bubbles to connect 3 or more of the same color to blast them.
- **Floating Debris Drop**: Any bubbles disconnected from the ceiling will fall down for bonus points!
- **5 Unique Levels**: Progressively faster and more complex bubble arrangements.
- **Smooth Physics**: Includes a visual aim predictor that bounced off walls, particle blast effect physics, and gravity.
- **Synthesizer Audio**: Uses the native Web Audio API to procedurally generate retro shoot, pop, bounce, and victory sounds.
- **Modern UI UI**: Glassmorphism aesthetic, responsive styling, and fluid animations.
- **100% Mobile Ready**: Full touch support and canvas resizing prevents scrolling issues.

---

## 🚀 How To Run Locally

Because this project uses modular vanilla JS and no outside assets (like images or external sound files), you can run it almost instantly!

### Option 1: Direct File Open (Easiest)
1. Traverse to the project directory in your file explorer.
2. Double-click on `index.html` to open it in your default web browser (Chrome, Firefox, Safari, Edge).
3. The game will launch immediately!

### Option 2: Local Web Server (Recommended)
Sometimes browser security policies prevent certain JS features when using the `file://` protocol. Running a quick local server prevents this.
If you have **Python** installed:
1. Open your terminal in the project folder.
2. Run: `python -m http.server 8000` (or `python3`).
3. Open `http://localhost:8000` in your web browser.

If you have **Node.js**:
1. Run `npx serve` in the project folder.
2. Open the localhost link it provides.

---

## 🌐 How To Deploy to GitHub Pages (Free Hosting)

GitHub Pages allows you to host static websites for free directly from a GitHub repository.

1. **Create a Repository:**
   - Log into [GitHub](https://github.com/).
   - Click the **+** icon in the top right and select **New repository**.
   - Name it `bubble-shooter` (or anything you prefer).
   - Leave it **Public** and click **Create repository**.

2. **Upload Your Files:**
   - On the next screen, click the link that says **"uploading an existing file"**.
   - Drag and drop `index.html`, `style.css`, `script.js`, and `README.md` into the box.
   - Commit the changes.

3. **Enable GitHub Pages:**
   - Click on the **Settings** tab of your repository.
   - On the left sidebar, scroll down to the **Pages** section.
   - Under **Build and deployment > Source**, select **Deploy from a branch**.
   - Under the **Branch** dropdown, select `main` (or `master`), choose the `/ (root)` folder, and click **Save**.

4. **Play Live:**
   - Wait 1-2 minutes for GitHub to build your site.
   - Refresh the Pages settings tab, and you will see a link at the top: *Your site is live at `https://[your-username].github.io/bubble-shooter/`*.
   - Share this link with your friends to play!

## Controls
- **Desktop**: Move mouse to aim. Click Left Mouse Button to shoot.
- **Mobile**: Touch and drag to aim. Release or tap to shoot.

Enjoy the game!
