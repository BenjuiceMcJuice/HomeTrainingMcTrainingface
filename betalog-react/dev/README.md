# dev/ — verification harness, not shipped

`vite.fake.config.js` runs the app with Firebase replaced by the in-memory
fakes in `fake-firebase/`: a signed-in user (`dev-uid`), a Firestore that
lives in the page and forgets on reload, no network. Used to see a change
running in Chromium when a cloud session cannot sign in to the real project
(first for BTL-B63–66, then the competitions build).

    npx vite --config dev/vite.fake.config.js --port 5199

Nothing here is imported by the app or the build.
