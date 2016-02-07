'use strict'

var influx = require('influx')
var _ = require('lodash')
var moment = require('moment')

var defaults = {
  plugin: 'vidi-toolbag-influx',
  enabled: true,
  influx: {
    host:'192.168.99.100',
    port:'8086',
    username:'stats',
    password:'stats',
    database:'seneca_stats'
  }
}

module.exports = function (opts) {
  var seneca = this
  var extend = seneca.util.deepextend

  opts = extend(defaults, opts)

  seneca.add({role: 'vidi', group: 'toolbag', stat: 'process'}, process_stats)
  seneca.add({role: 'vidi', group: 'toolbag', stat: 'cpu'}, cpu_stats)
  seneca.add({role: 'vidi', group: 'toolbag', stat: 'event_loop'}, event_loop_stats)

  function process_stats (msg, done) {
    this.prior(msg, function (err, payload) {
      if (!opts.enabled) {
        return done(null, data)
      }

      var db = influx(opts.influx)
      var qry = 'SELECT * FROM "process_snapshot" WHERE time > now() - 120s GROUP BY "pid"'
      db.query(qry, (err, data) => {
        if (err) {
          seneca.log.error(err)
          opts.enabled = false
        }
        else {
          payload = payload || []
          data = _.groupBy(data[0], 'pid')

          _.each(data, (proc) => {
            var latest = _.last(proc)

            payload.push({
              stat:   'process_snapshot',
              group:  'toolbag',
              pid:    latest.pid,
              latest: latest,
              series: {
                time:      _.map(proc, 'time'),
                ram_total: _.map(proc, 'ram_total'),
                ram_used:  _.map(proc, 'ram_used')
              }
            })
          })
        }

        done(null, payload)
      })

    })
  }

  function cpu_stats (msg, done) {
    this.prior(msg, function (err, payload) {
      if (!opts.enabled) {
        return done(null, data)
      }

      var db = influx(opts.influx)
      var qry = 'SELECT * FROM "cpu_snapshot" WHERE time > now() - 120s'
      db.query(qry, (err, data) => {
        if (err) {
          seneca.log.error(err)
          opts.enabled = false
        }
        else {
          data = data[0]

          var time_series = _.map(data, metric => metric.time)

          payload = payload || {}
          payload.group = 'toolbag'
          payload.stat = 'cpu_snapshot'
          payload.latest = _.last(data)
        }

        done(null, payload)
      })

    })
  }

  function event_loop_stats (msg, done) {
    this.prior(msg, function (err, payload) {
      if (!opts.enabled) {
        return done(null, data)
      }

      var db = influx(opts.influx)
      var qry = 'SELECT * FROM "event_loop_snapshot" WHERE time > now() - 120s'
      db.query(qry, (err, data) => {
        if (err) {
          seneca.log.error(err)
          opts.enabled = false
        }
        else {
          data = data[0]

          var time_series = _.map(data, metric => metric.time)

          payload = payload || {}
          payload.group = 'toolbag'
          payload.stat = 'event_loop_snapshot'
          payload.latest = _.last(data)
        }

        done(null, payload)
      })
    })
  }


  return opts.plugin
}

function format_mem (bytes) {
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes == 0) return '0 Byte';
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));

  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}
