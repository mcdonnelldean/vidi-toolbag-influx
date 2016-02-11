'use strict'

var influx = require('influx')
var _ = require('lodash')
var moment = require('moment')

var defaults = {
  plugin: 'vidi-toolbag-influx',
  enabled: true,
  influx: {
    host:'localhost',
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
      payload = payload || []

      if (!opts.enabled) {
        return done(null, payload)
      }

      var db = influx(opts.influx)
      var qry = 'SELECT * FROM "process_snapshot" WHERE time > now() - 60s'
      db.query(qry, (err, data) => {
        if (err) {
          seneca.log.error(err)
          opts.enabled = false
        }
        else {
          data = _.groupBy(data[0], 'pid')

          _.each(data, (proc) => {
            var latest = _.clone(_.last(proc))
            latest.proc_uptime = moment().startOf('day').seconds(latest.proc_uptime).format('HH:mm:ss')
            latest.sys_uptime = moment().startOf('day').seconds(latest.sys_uptime).format('HH:mm:ss')
            latest.time = moment(latest.time).format('hh:mm:ss')
            latest.ram_total = format_mem(latest.ram_total)
            latest.ram_used = format_mem(latest.ram_total)
            latest.heap_total = format_mem(latest.heap_total)
            latest.heap_used = format_mem(latest.heap_used)
            latest.heap_rss = format_mem(latest.heap_rss)

            payload.push({
              stat:   'process_snapshot',
              group:  'toolbag',
              pid:    latest.pid,
              latest: latest,
              series: {
                time: _.map(proc, x => moment(x.time).format('hh:mm:ss')),
                ram_total: _.map(proc, x => format_mem(x.ram_total)),
                ram_used: _.map(proc, x => format_mem(x.ram_total)),
                heap_total: _.map(proc, x => format_mem(x.heap_total)),
                heap_used: _.map(proc, x => format_mem(x.heap_used)),
                heap_rss: _.map(proc, x => format_mem(x.heap_rss))
              }
            })
          })
        }

        done(err, payload)
      })

    })
  }

  function cpu_stats (msg, done) {
    this.prior(msg, function (err, payload) {
      payload = payload || []

      if (!opts.enabled) {
        return done(null, payload)
      }

      var db = influx(opts.influx)
      var qry = `SELECT * FROM "cpu_snapshot" WHERE time > now() - 120s`
      db.query(qry, (err, data) => {
        if (err) {
          seneca.log.error(err)
          opts.enabled = false
        }
        else {
          data = _.groupBy(data[0], 'pid')


          _.each(data, (proc) => {
            var latest = _.last(proc)

            payload.push({
              stat:   'cpu_snapshot',
              group:  'toolbag',
              pid:    latest.pid,
              latest: latest,
              series: {
                time: _.map(proc, x => moment(x.time).format('hh:mm:ss')),
                user: _.map(proc, x => x.user),
                nice: _.map(proc, x => x.nice)
              }
            })
          })
        }

        done(err, payload)
      })

    })
  }

  function event_loop_stats (msg, done) {
    this.prior(msg, function (err, payload) {
      payload = payload || []

      if (!opts.enabled) {
        return done(null, payload)
      }

      var db = influx(opts.influx)
      var qry = 'SELECT * FROM "event_loop_snapshot" WHERE time > now() - 120s'
      db.query(qry, (err, data) => {
        if (err) {
          seneca.log.error(err)
          opts.enabled = false
        }
        else {

          data = _.groupBy(data[0], 'pid')

          _.each(data, (proc) => {
            var latest = _.last(proc)

            payload.push({
              stat:   'event_loop_snapshot',
              group:  'toolbag',
              pid:    latest.pid,
              latest: latest,
              series: {
                time: _.map(proc, x => moment(x.time).format('hh:mm:ss')),
                delay: _.map(proc, x => Math.round(x.delay)),
                limit: _.map(proc, x => x.limit)
              }
            })
          })
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

  return Math.round(bytes / Math.pow(1024, i), 2);
}

function msToHMS( ms ) {
    // 1- Convert to seconds:
    var seconds = Math.floor(ms);
    // 2- Extract hours:
    var hours = parseInt( seconds / 3600 ); // 3,600 seconds in 1 hour
    seconds = seconds % 3600; // seconds remaining after extracting hours
    // 3- Extract minutes:
    var minutes = parseInt( seconds / 60 ); // 60 seconds in 1 minute
    // 4- Keep only seconds not extracted to minutes:
    seconds = seconds % 60;
    return (hours+":"+minutes+":"+seconds);
}
