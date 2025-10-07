import router from '@adonisjs/core/services/router'
import ProxyController from '#controllers/proxy_controller'

router.on('/').renderInertia('home')

// Proxy route to act like UmlautAdaptarr
router.any('/_/:domain/*', [ProxyController, 'handleProxyRequest'])
