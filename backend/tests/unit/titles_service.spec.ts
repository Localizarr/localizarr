import { test } from '@japa/runner'
import { TitlesService } from '../../app/repositories/titles_service.js'

test.group('TitlesService - Title Replacement', () => {
  test('processItemForReplacement replaces localized title in title field', ({ assert }) => {
    // Setup mock replacements
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('pacificador', 'Peacemaker')
    mockReplacements.set('os garotos', 'The Boys')

    // Set the replacements for testing
    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'Pacificador S02E07 Like a Keith in the Night 2160p MAX WEB-DL DDP5 1 DV HEVC',
      otherField: 'some value'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'Peacemaker S02E07 Like a Keith in the Night 2160p MAX WEB-DL DDP5 1 DV HEVC')
    assert.equal(result.otherField, 'some value')
  })

  test('processItemForReplacement replaces multiple occurrences in title field', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('pacificador', 'Peacemaker')

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      title: 'Pacificador S02E07 Pacificador Special Episode'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'title')

    assert.equal(result.title, 'Peacemaker S02E07 Peacemaker Special Episode')
  })

  test('processItemForReplacement handles case insensitive replacement', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('pacificador', 'Peacemaker')

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'PACIFICADOR S02E07 Like a Keith in the Night'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'Peacemaker S02E07 Like a Keith in the Night')
  })

  test('processItemForReplacement does not modify item when no replacements match', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('Pacificador', 'Peacemaker')

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'The Witcher S02E07 Something Else'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'The Witcher S02E07 Something Else')
  })

  test('processItemForReplacement processes nested strings', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('Pacificador', 'Peacemaker')

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'Pacificador S02E07',
      metadata: {
        description: 'Pacificador episode description',
        tags: ['Pacificador', 'action']
      }
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'Peacemaker S02E07')
    assert.equal(result.metadata.description, 'Peacemaker episode description')
    assert.deepEqual(result.metadata.tags, ['Peacemaker', 'action'])
  })

  test('processNestedStrings replaces strings in nested objects', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('Pacificador', 'Peacemaker')
    mockReplacements.set('Os Garotos', 'The Boys')

    TitlesService.setTitleReplacements(mockReplacements)

    const obj = {
      title: 'Pacificador',
      metadata: {
        description: 'Pacificador episode about Os Garotos',
        nested: {
          text: 'Os Garotos series'
        }
      },
      arrayField: ['Pacificador', 'other']
    }

      ; (TitlesService as any).processNestedStrings(obj)

    assert.equal(obj.title, 'Peacemaker')
    assert.equal(obj.metadata.description, 'Peacemaker episode about The Boys')
    assert.equal(obj.metadata.nested.text, 'The Boys series')
    assert.deepEqual(obj.arrayField, ['Peacemaker', 'other'])
  })

  test('processNestedStrings handles null and non-object values', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('test', 'replacement')

    TitlesService.setTitleReplacements(mockReplacements)

      // Should not throw errors
      ; (TitlesService as any).processNestedStrings(null)
      ; (TitlesService as any).processNestedStrings('string')
      ; (TitlesService as any).processNestedStrings(123)
      ; (TitlesService as any).processNestedStrings(undefined)

    assert.isTrue(true) // If we reach here, no errors were thrown
  })

  test('processItemForReplacement handles kebab-case variants', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('pacificador', 'Peacemaker') // normalized

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'pacificador-s02e07 episode title'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'Peacemaker-s02e07 episode title')
  })

  test('processItemForReplacement handles dot-case variants', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('pacificador', 'Peacemaker') // normalized

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'pacificador.s02e07 episode title'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'Peacemaker.s02e07 episode title')
  })

  test('processItemForReplacement handles diacritics', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('pacificador', 'Peacemaker') // normalized

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'pacifícador s02e07 episode title'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'Peacemaker s02e07 episode title')
  })

  test('processItemForReplacement handles multi-word with separators', ({ assert }) => {
    const mockReplacements = new Map<string, string>()
    mockReplacements.set('os garotos', 'The Boys') // normalized

    TitlesService.setTitleReplacements(mockReplacements)

    const item = {
      n: 'os-garotos s02e07 episode title'
    }

    const result = (TitlesService as any).processItemForReplacement(item, 'n')

    assert.equal(result.n, 'The Boys s02e07 episode title')
  })
})
