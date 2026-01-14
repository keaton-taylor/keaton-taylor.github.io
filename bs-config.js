module.exports = {
  proxy: "localhost:4000",
  files: [
    "_site/**/*"
  ],
  watchOptions: {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500
    }
  },
  notify: false,
  open: false,
  port: 3000,
  reloadDelay: 300
}
