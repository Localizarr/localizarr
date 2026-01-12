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
          q.where('original_title', 'ILIKE', `%${search}%`)
            .orWhereHas('localizedNames', (lq) => {
              lq.where('localized_name', 'ILIKE', `%${search}%`)
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
      console.log(`[titles_controller] Localized names before delete: ${countBefore[0].total}`)

      // Delete all localized names first
      const deleteResult = await LocalizedName.query().delete()
      console.log(`[titles_controller] Delete result:`, deleteResult)

      // Count after delete
      const countAfter = await LocalizedName.query().count('* as total')
      console.log(`[titles_controller] Localized names after delete: ${countAfter[0].total}`)

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
