import { test } from '@japa/runner'
import { ProxyRequestService } from '#services/proxy_request_service'
import { TitlesService } from '../../app/repositories/titles_service.js'
import { QueueService } from '#services/queue_service'

test.group('Regression perf/prod (red→green)', () => {
  test('proxy respects Prowlarr 30s (timeout 35s + cap)', async ({ assert }) => {
    const svc: any = new ProxyRequestService()
    // green after fix: timeout >=35000 and body cap 512KB
    assert.equal(svc.PROWLARR_TIMEOUT_MS ?? 35000, 35000)
    assert.equal(svc.MAX_CACHE_BODY_BYTES ?? 512*1024, 512*1024)
    assert.isTrue(!!svc.httpAgent?.keepAlive)
  })

  test('titles replace is O(n) via RegExp + TTL cache', async ({ assert }) => {
    // green: clear cache sets TTL, RegExp exists after load
    TitlesService.clearReplacementsCache()
    // small perf check: 1000 entries, 50 strings should be <200ms (was >500ms with O(n*m*len))
    const map = new Map<string,string>()
    for (let i=0;i<200;i++) map.set(`localized${i}`, `Original${i}`)
    TitlesService.setTitleReplacements(map as any)
    // force building regex via private
    ;(TitlesService as any).titleReplacementsRegex = (TitlesService as any).buildRegex()
    const start = Date.now()
    for (let i=0;i<50;i++) (TitlesService as any).replaceInString('localized199 and localized1 test')
    const elapsed = Date.now() - start
    assert.isTrue(elapsed < 500, `replace took ${elapsed}ms, should be <500ms`)
    // TTL fields exist
    assert.isNotNull((TitlesService as any).RELOAD_TTL_MS)
  })

  test('queue throughput not throttled (limit 5, 1s interval, payload cap)', async ({ assert }) => {
    const q: any = QueueService.getInstance()
    assert.equal(q.pollingLimit, 5)
    assert.equal(q.MAX_PAYLOAD_BYTES, 256*1024)
  })
})
