import { test } from '@japa/runner'
import TitlesController from '#controllers/titles_controller'
import Title from '#models/title'
import LocalizedName from '#models/localized_name'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeMockResponse() {
  return {
    statusCode: 200,
    jsonData: null as any,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: any) {
      this.jsonData = data
    },
  }
}

function makeMockRequest(body: Record<string, any>) {
  return {
    only: () => body,
    header: () => null,
  }
}

const mockSession = { flash: () => { } }

// ─── TitlesController.store ───────────────────────────────────────────────────

test.group('TitlesController - Store', (group) => {
  group.each.setup(() => {
    // Reset mocks before each test
  })

  test('successfully creates a title with localized name', async ({ assert }) => {
    const mockTitle = {
      id: 1,
      imdbId: 'tt1234567',
      mediaType: 'tv',
      originalTitle: 'Peacemaker',
    }
    Title.create = async () => mockTitle as any
    LocalizedName.create = async () => ({ id: 1 } as any)

    const ctx = {
      request: makeMockRequest({
        originalTitle: 'Peacemaker',
        imdbId: 'tt1234567',
        mediaType: 'tv',
        langId: 'pt-BR',
        localizedName: 'Pacificador',
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 201)
    assert.deepEqual(ctx.response.jsonData, { success: true, data: mockTitle })
  })

  test('validates required fields - missing originalTitle', async ({ assert }) => {
    const ctx = {
      request: makeMockRequest({
        imdbId: 'tt1234567',
        mediaType: 'tv',
        langId: 'pt-BR',
        localizedName: 'Pacificador',
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 400)
    assert.deepEqual(ctx.response.jsonData, {
      success: false,
      message: 'Original title, localized name, and language are required',
    })
  })

  test('validates required fields - missing localizedName', async ({ assert }) => {
    const ctx = {
      request: makeMockRequest({
        originalTitle: 'Peacemaker',
        imdbId: 'tt1234567',
        mediaType: 'tv',
        langId: 'pt-BR',
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 400)
    assert.deepEqual(ctx.response.jsonData, {
      success: false,
      message: 'Original title, localized name, and language are required',
    })
  })

  test('validates required fields - missing langId', async ({ assert }) => {
    const ctx = {
      request: makeMockRequest({
        originalTitle: 'Peacemaker',
        imdbId: 'tt1234567',
        mediaType: 'tv',
        localizedName: 'Pacificador',
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 400)
    assert.deepEqual(ctx.response.jsonData, {
      success: false,
      message: 'Original title, localized name, and language are required',
    })
  })

  test('handles optional fields correctly', async ({ assert }) => {
    const mockTitle = {
      id: 1,
      imdbId: `manual_${Date.now()}`,
      mediaType: 'tv',
      originalTitle: 'Peacemaker',
    }

    Title.create = async (data: any) => {
      assert.equal(data.imdbId.startsWith('manual_'), true)
      assert.equal(data.mediaType, 'tv')
      return mockTitle as any
    }

    LocalizedName.create = async () => ({ id: 1 } as any)

    const ctx = {
      request: makeMockRequest({
        originalTitle: 'Peacemaker',
        langId: 'pt-BR',
        localizedName: 'Pacificador',
        // imdbId and mediaType are optional
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 201)
  })

  test('trims whitespace from titles', async ({ assert }) => {
    Title.create = async (data: any) => {
      assert.equal(data.originalTitle, 'Peacemaker')
      return { id: 1 } as any
    }

    LocalizedName.create = async (data: any) => {
      assert.equal(data.localizedName, 'Pacificador')
      return { id: 1 } as any
    }

    const ctx = {
      request: makeMockRequest({
        originalTitle: '  Peacemaker  ',
        imdbId: 'tt1234567',
        mediaType: 'tv',
        langId: 'pt-BR',
        localizedName: '  Pacificador  ',
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 201)
  })

  test('handles database errors gracefully', async ({ assert }) => {
    Title.create = async () => {
      throw new Error('Database connection failed')
    }

    const ctx = {
      request: makeMockRequest({
        originalTitle: 'Peacemaker',
        imdbId: 'tt1234567',
        mediaType: 'tv',
        langId: 'pt-BR',
        localizedName: 'Pacificador',
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 500)
    assert.deepEqual(ctx.response.jsonData, {
      success: false,
      message: 'Error creating title',
      error: 'Database connection failed',
    })
  })

  test('handles LocalizedName creation errors', async ({ assert }) => {
    Title.create = async () => ({ id: 1 } as any)
    LocalizedName.create = async () => {
      throw new Error('Foreign key constraint failed')
    }

    const ctx = {
      request: makeMockRequest({
        originalTitle: 'Peacemaker',
        imdbId: 'tt1234567',
        mediaType: 'tv',
        langId: 'pt-BR',
        localizedName: 'Pacificador',
      }),
      response: makeMockResponse(),
      session: mockSession,
    }

    const controller = new TitlesController()
    await controller.store(ctx as any)

    assert.equal(ctx.response.statusCode, 500)
    assert.deepEqual(ctx.response.jsonData, {
      success: false,
      message: 'Error creating title',
      error: 'Foreign key constraint failed',
    })
  })
})
