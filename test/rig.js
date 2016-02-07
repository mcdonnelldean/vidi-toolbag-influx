
'strict'

const config = {
  stats: {collector: true},
  influx_stats_store: {influx: {host: '192.168.99.100'}}
}

var s = require('seneca')()
  .use('stats', config.stats)
  .use('toolbag-stats', {})
  .use('influx-stats-store', config.influx_stats_store)
  .use('..', config.influx_stats_store)
  .listen()

setTimeout(function () {

  s.act({role: 'vidi', group: 'toolbag', stat: 'event_loop'}, (err, msg) => {
    console.log(JSON.stringify(msg, null, 2))
  })

  s.act({role: 'vidi', group: 'toolbag', stat: 'process'}, (err, msg) => {
    console.log(JSON.stringify(msg, null, 2))
  })

}, 1000)
