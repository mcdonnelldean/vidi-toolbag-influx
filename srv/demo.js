
'strict'


const config = {
  influx_sink: {influx: {host: '192.168.99.100'}},
  metrics: {collector: {enabled: true}}
}

var s = require('seneca')()
  .use('vidi-metrics', config.metrics)
  .use('vidi-toolbag-metrics')
  .use('vidi-influx-sink', config.influx_sink)
  .use(require('..'), config.influx_sink)
  .listen()

setTimeout(function () {

  s.act({role: 'vidi', source: 'toolbag', metric: 'event_loop'}, (err, msg) => {
    console.log(JSON.stringify(msg, null, 2))
  })

  s.act({role: 'vidi', source: 'toolbag', metric: 'process'}, (err, msg) => {
    console.log(JSON.stringify(msg, null, 2))
  })

}, 1000)
