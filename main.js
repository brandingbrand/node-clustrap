var os      = require('os')
  , fs      = require('fs')
  , cluster = require('cluster')
  , colors  = require('colors')

module.exports = function(app, options) {
  var logger  = (options && options.logger) || app.get('logger') || console
    , port    = (options && options.port) || app.get('port')
    , sock    = (options && options.sock) || app.get('sock')
    , workers

  if (options && typeof options.workers === 'number') {
    workers = options.workers
  } else if (options && (options.workers === false || options.workers === 'false')) {
    workers = 0
  } else {
    workers = app.get('workers') || os.cpus().length
  }

  // skip cluster if no workers
  if (workers === 0) {
    return listen()
  }

  // use cluster
  if (cluster.isMaster) {
    logger.info("forking " + String(workers).yellow + " worker processes")

    // remove previous socket before continuing start-up
    if (sock) {
      fs.unlink(sock, function(err) {
        // suppress ENOENT error as it simply means the sock didn't previously exist
        if (err && err.code !== "ENOENT") {
          logger.error(err)
        }
      })
    }

    cluster.on('exit', function(worker, code, signal) {
      logger.error(('worker ' + worker.process.pid + ' died').red + ', reforking...')
      var worker = cluster.fork()
    })

    // Fork workers.
    for (var i = 0; i < workers; i++) {
      cluster.fork()
    }

  } else {
    listen()
  }

  function listen () {
    if (sock) { listenOnSocket(sock) }
    else {      listenOnPort(port) }
  }

  function listenOnPort (port) {
    app.listen(port, function() {
      var s = (app.get('name') || "app").green
        + " listening on port " + String(port).yellow
        + " in " + app.settings.env.yellow + " mode"
      if (workers) s = s + " with " + String(workers).yellow + " workers"
      logger.info(s)
    })
  }

  function listenOnSocket (sock) {
    var oldUmask = process.umask(0000)

    app.listen(sock, function() {
      process.umask(oldUmask)
      var s = (app.get('name') || "app").green
        + " listening at " + String(sock).yellow
        + " in " + app.settings.env.yellow + " mode"
      if (workers) s = s + " with " + String(workers).yellow + " workers"
      logger.info(s)
    })
  }
}
