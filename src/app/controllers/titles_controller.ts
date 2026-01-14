import type { HttpContext } from '@adonisjs/core/http'
import Title from '#models/title'
import LocalizedName from '#models/localized_name'

export default class TitlesController {
  /**
   * List all titles with optional filtering
   * Supports both Inertia (render) and API (JSON)
   */
  public async index({ inertia, request, response }: HttpContext) {
    try {
      const { search, lang, page = 1, limit = 12 } = request.qs()

      let query = Title.query().preload('localizedNames').has('localizedNames')

      if (search) {
        query = query.where((q) => {
          q.where('original_title', 'LIKE', `%${search}%`).orWhereHas('localizedNames', (lq) => {
            lq.where('localized_name', 'LIKE', `%${search}%`)
          })
        })
      }

      if (lang) {
        query = query.whereHas('localizedNames', (localizedQuery) => {
          localizedQuery.where('lang_id', lang)
        })
      }

      query.orderBy('updated_at', 'desc')

      const titles = await query.paginate(page, limit)

      // Log IMDb data for titles that have it
      for (const title of titles) {
        if (title.imdbData) {
          console.log(`[TitlesController] IMDb data for title ${title.id} (${title.imdbId}): ${JSON.stringify(title.imdbData)}`)
        }
      }

      // API request returns JSON
      if (request.url().startsWith('/api')) {
        return response.json({
          success: true,
          data: titles,
        })
      }

      // Web/Inertia request renders view
      return inertia.render('home', { titles: titles.serialize() })
    } catch (error) {
      console.error(error)
      if (request.url().startsWith('/api')) {
        return response.status(500).json({
          success: false,
          message: 'Error fetching titles',
          error: error.message,
        })
      }
      return response.status(500).send(error.message)
    }
  }

  /**
   * Store a new title with localized name
   */
  public async store({ request, response, session }: HttpContext) {
    try {
      const { originalTitle, imdbId, mediaType, langId, localizedName } = request.only([
        'originalTitle',
        'imdbId',
        'mediaType',
        'langId',
        'localizedName'
      ])

      if (!originalTitle || !localizedName || !langId) {
        if (request.header('X-Inertia')) {
          session.flash('error', 'Original title, localized name, and language are required')
          return response.redirect().back()
        }
        return response.status(400).json({
          success: false,
          message: 'Original title, localized name, and language are required',
        })
      }

      // Create the title
      const title = await Title.create({
        imdbId: imdbId || `manual_${Date.now()}`,
        mediaType: mediaType || 'tv',
        originalTitle: originalTitle.trim(),
      })

      // Create the localized name
      await LocalizedName.create({
        titleId: title.id,
        langId: langId,
        localizedName: localizedName.trim(),
      })

      if (request.header('X-Inertia')) {
        session.flash('success', 'Title added successfully')
        return response.redirect().back()
      }

      return response.status(201).json({
        success: true,
        data: title,
      })
    } catch (error) {
      console.error('Error creating title:', error)
      if (request.header('X-Inertia')) {
        session.flash('error', 'Error creating title')
        return response.redirect().back()
      }
      return response.status(500).json({
        success: false,
        message: 'Error creating title',
        error: error.message,
      })
    }
  }

  /**
   * Get localized names for a specific title (API only)
   */
  public async localizedNames({ params, response }: HttpContext) {
    try {
      const titleId = params.id
      const localizedNames = await LocalizedName.query().where('title_id', titleId).preload('title')
      return response.json({
        success: true,
        data: localizedNames,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Error fetching localized names',
        error: error.message,
      })
    }
  }

  /**
   * Store a new localized name for a title
   */
  public async storeLocalizedName({ params, request, response, session }: HttpContext) {
    try {
      const titleId = params.id
      const { localizedName, langId } = request.only(['localizedName', 'langId'])

      if (!localizedName || !langId) {
        if (request.header('X-Inertia')) {
          session.flash('error', 'Localized name and language ID are required')
          return response.redirect().back()
        }
        return response.status(400).json({
          success: false,
          message: 'Localized name and language ID are required',
        })
      }

      // Check if the title exists
      const title = await Title.find(titleId)
      if (!title) {
        if (request.header('X-Inertia')) {
          session.flash('error', 'Title not found')
          return response.redirect().back()
        }
        return response.status(404).json({
          success: false,
          message: 'Title not found',
        })
      }

      // Create the localized name
      const newLocalized = await LocalizedName.create({
        titleId: titleId,
        langId: langId,
        localizedName: localizedName.trim(),
      })

      // Check if this is an Inertia request
      if (request.header('X-Inertia')) {
        // For Inertia requests, redirect back to refresh the page
        return response.redirect().back()
      }

      // For API requests, return JSON
      return response.status(201).json({
        success: true,
        data: newLocalized,
      })
    } catch (error) {
      console.error('Error creating localized name:', error)
      if (request.header('X-Inertia')) {
        session.flash('error', 'Error creating localized name')
        return response.redirect().back()
      }
      return response.status(500).json({
        success: false,
        message: 'Error creating localized name',
        error: error.message,
      })
    }
  }

  /**
   * Delete a title and its localized names
   */
  public async destroy({ params, response }: HttpContext) {
    try {
      const titleId = params.id

      const title = await Title.find(titleId)
      if (title) {
        // Delete localized names first
        await LocalizedName.query().where('title_id', titleId).delete()
        // Delete title
        await title.delete()
      }

      // Inertia redirect back to refresh state
      return response.redirect().back()
    } catch (error) {
      console.error(error)
      return response.redirect().back()
    }
  }

  /**
   * Delete a specific localized name
   */
  public async destroyLocalizedName({ params, response }: HttpContext) {
    try {
      const localizedNameId = params.localizedNameId
      console.log(`[TitlesController] Request to delete localized name: ${localizedNameId}`)

      const localizedName = await LocalizedName.find(localizedNameId)
      if (localizedName) {
        await localizedName.delete()
      }

      // Inertia redirect back to refresh state
      return response.redirect().back()
    } catch (error) {
      console.error(error)
      return response.redirect().back()
    }
  }

  /**
   * Clear all localized names
   */
  public async clearAll({ response, session }: HttpContext) {
    try {
      console.log('[titles_controller] Starting clearAll operation')

      // Count before delete
      const countBefore = await LocalizedName.query().count('* as total')
      console.log(`[titles_controller] Localized names before delete: ${(countBefore[0] as any).$extras.total}`)

      // Delete all localized names first
      const deleteResult = await LocalizedName.query().delete()
      console.log(`[titles_controller] Delete result:`, deleteResult)

      // Count after delete
      const countAfter = await LocalizedName.query().count('* as total')
      console.log(`[titles_controller] Localized names after delete: ${(countAfter[0] as any).$extras.total}`)

      // Preserve titles, only clear localizations as requested
      // await Title.query().delete()

      console.log('[titles_controller] ClearAll operation completed successfully')

      // Flash success message
      session.flash('success', `Cleared ${deleteResult} localized names from database.`)

      // Inertia redirect back to refresh state
      return response.redirect().back()
    } catch (error) {
      console.error('[titles_controller] Error in clearAll:', error)
      session.flash('error', 'Failed to clear localized names.')
      return response.redirect().back()
    }
  }
}
