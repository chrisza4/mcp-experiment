export class Logger {
  info(...args) {
    console.log(...args)
  }
  debug(...args) {
    if (process.env.DEBUG) {
      console.debug(...args)
    }
  }
}
