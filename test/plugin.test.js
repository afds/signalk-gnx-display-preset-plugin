const { expect } = require('chai')
const EventEmitter = require('events')
const pluginFactory = require('../dist/').default

function createMockApp(pathStore) {
  const app = new EventEmitter()
  app.emitted = []
  const origEmit = app.emit.bind(app)
  app.emit = function (event, ...args) {
    if (event === 'nmea2000JsonOut') {
      app.emitted.push(args[0])
    }
    return origEmit(event, ...args)
  }
  app.debug = () => {}
  app.error = () => {}
  app.setPluginStatus = () => {}
  app.setPluginError = () => {}
  app.emitPropertyValue = () => {}
  app.getSelfPath = (path) => pathStore[path]

  // Mock subscription manager: captures the delta callback so tests can trigger it
  app._deltaCb = null
  app._subscribedPaths = null
  app.subscriptionmanager = {
    subscribe: (command, unsubscribes, errCb, deltaCb) => {
      app._subscribedPaths = command.subscribe.map(s => s.path)
      app._deltaCb = deltaCb
      unsubscribes.push(() => {
        app._deltaCb = null
        app._subscribedPaths = null
      })
    }
  }

  return app
}

function createMockRouter() {
  const routes = { get: {} }
  return {
    get: (path, handler) => { routes.get[path] = handler },
    _routes: routes
  }
}

function createMockRes() {
  const res = {
    body: null,
    json: function (data) { res.body = data; return res }
  }
  return res
}

const DEFAULT_CONFIG = {
  sourceAddress: 0,
  activeProfile: 'test',
  debounceMs: 10,
  profiles: [
    {
      name: 'test',
      presets: [
        { conditions: [{ path: 'navigation.racing.status', operator: 'equals', value: 'countdown' }] },
        { conditions: [{ path: 'navigation.racing.status', operator: 'equals', value: 'racing' }] },
        { conditions: [] },
        { conditions: [] }
      ]
    }
  ]
}

describe('Plugin lifecycle', () => {
  it('creates plugin with correct id and name', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    expect(plugin.id).to.equal('signalk-gnx-display-preset-plugin')
    expect(plugin.name).to.equal('GNX Display Preset Selector')
  })

  it('has a configuration schema', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    expect(plugin.schema).to.exist
    expect(plugin.schema.properties.profiles).to.exist
    expect(plugin.schema.properties.activeProfile).to.exist
  })

  it('starts and stops without errors', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    plugin.start(DEFAULT_CONFIG)
    plugin.stop()
  })

  it('registers custom PGN definitions on start', () => {
    const app = createMockApp({})
    let registeredPgns = null
    app.emitPropertyValue = (key, value) => {
      if (key === 'canboat-custom-pgns') registeredPgns = value
    }
    const plugin = pluginFactory(app)
    plugin.start(DEFAULT_CONFIG)
    expect(registeredPgns).to.exist
    expect(registeredPgns.PGNs).to.have.lengthOf(1)
    expect(registeredPgns.PGNs[0].PGN).to.equal(61184)
    plugin.stop()
  })
})


describe('Subscription setup', () => {
  it('subscribes to paths from active profile', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    plugin.start(DEFAULT_CONFIG)
    expect(app._subscribedPaths).to.include('navigation.racing.status')
    plugin.stop()
  })

  it('does not subscribe if no profile matches', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, activeProfile: 'nonexistent' })
    expect(app._subscribedPaths).to.be.null
    plugin.stop()
  })

  it('does not subscribe if active profile has no conditions', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    plugin.start({
      ...DEFAULT_CONFIG,
      profiles: [{ name: 'test', presets: [{ conditions: [] }, { conditions: [] }, { conditions: [] }, { conditions: [] }] }]
    })
    expect(app._subscribedPaths).to.be.null
    plugin.stop()
  })

  it('unsubscribes on stop', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    plugin.start(DEFAULT_CONFIG)
    expect(app._subscribedPaths).to.not.be.null
    plugin.stop()
    expect(app._deltaCb).to.be.null
  })
})


describe('Preset emission', () => {
  it('emits PGN when condition matches', function (done) {
    const pathStore = { 'navigation.racing.status.value': 'countdown' }
    const app = createMockApp(pathStore)
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, debounceMs: 5 })

    app._deltaCb({})

    setTimeout(() => {
      expect(app.emitted.length).to.be.greaterThan(0)
      const pgn = app.emitted[app.emitted.length - 1]
      expect(pgn.pgn).to.equal(61184)
      expect(pgn['Command']).to.equal(0x84)
      expect(pgn['Preset Index']).to.equal(0)
      expect(pgn['Manufacturer Code']).to.equal(229)
      expect(pgn['Industry Code']).to.equal(4)
      plugin.stop()
      done()
    }, 20)
  })

  it('selects second preset when first does not match', function (done) {
    const pathStore = { 'navigation.racing.status.value': 'racing' }
    const app = createMockApp(pathStore)
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, debounceMs: 5 })

    app._deltaCb({})

    setTimeout(() => {
      const pgn = app.emitted[app.emitted.length - 1]
      expect(pgn['Preset Index']).to.equal(1)
      plugin.stop()
      done()
    }, 20)
  })

  it('does not emit when no conditions match', function (done) {
    const pathStore = { 'navigation.racing.status.value': 'unknown' }
    const app = createMockApp(pathStore)
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, debounceMs: 5 })

    // Clear any emissions from initial timer
    app.emitted = []
    app._deltaCb({})

    setTimeout(() => {
      expect(app.emitted).to.have.lengthOf(0)
      plugin.stop()
      done()
    }, 20)
  })

  it('does not re-emit when preset stays the same', function (done) {
    const pathStore = { 'navigation.racing.status.value': 'countdown' }
    const app = createMockApp(pathStore)
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, debounceMs: 5 })

    app._deltaCb({})

    setTimeout(() => {
      const countAfterFirst = app.emitted.length
      app._deltaCb({})

      setTimeout(() => {
        expect(app.emitted.length).to.equal(countAfterFirst)
        plugin.stop()
        done()
      }, 20)
    }, 20)
  })

  it('emits new PGN when preset changes', function (done) {
    const pathStore = { 'navigation.racing.status.value': 'countdown' }
    const app = createMockApp(pathStore)
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, debounceMs: 5 })

    app._deltaCb({})

    setTimeout(() => {
      const countAfterFirst = app.emitted.length
      pathStore['navigation.racing.status.value'] = 'racing'
      app._deltaCb({})

      setTimeout(() => {
        expect(app.emitted.length).to.be.greaterThan(countAfterFirst)
        const pgn = app.emitted[app.emitted.length - 1]
        expect(pgn['Preset Index']).to.equal(1)
        plugin.stop()
        done()
      }, 20)
    }, 20)
  })

  it('uses configured source address', function (done) {
    const pathStore = { 'navigation.racing.status.value': 'countdown' }
    const app = createMockApp(pathStore)
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, sourceAddress: 42, debounceMs: 5 })

    app._deltaCb({})

    setTimeout(() => {
      const pgn = app.emitted[app.emitted.length - 1]
      expect(pgn.src).to.equal(42)
      plugin.stop()
      done()
    }, 20)
  })
})


describe('Debounce', () => {
  it('coalesces rapid updates into single evaluation', function (done) {
    const pathStore = { 'navigation.racing.status.value': 'countdown' }
    const app = createMockApp(pathStore)
    const plugin = pluginFactory(app)
    plugin.start({ ...DEFAULT_CONFIG, debounceMs: 30 })

    // Clear initial timer emissions
    app.emitted = []

    // Fire multiple rapid deltas
    app._deltaCb({})
    app._deltaCb({})
    app._deltaCb({})

    setTimeout(() => {
      // Should have at most 1 emission (debounce coalesced)
      expect(app.emitted.length).to.be.at.most(1)
      plugin.stop()
      done()
    }, 60)
  })
})


describe('REST API', () => {
  it('GET /state returns plugin state', () => {
    const app = createMockApp({})
    const plugin = pluginFactory(app)
    const router = createMockRouter()
    plugin.registerWithRouter(router)
    plugin.start(DEFAULT_CONFIG)

    const res = createMockRes()
    router._routes.get['/state']({}, res)

    expect(res.body.activeProfile).to.equal('test')
    expect(res.body.activePreset).to.be.null
    expect(res.body.profiles).to.deep.equal(['test'])
    plugin.stop()
  })
})
