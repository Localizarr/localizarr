import type { HttpContext } from "@adonisjs/core/http";
import Title from "#models/title";
import LocalizedName from "#models/localized_name";

export default class TitlesController {
  /**
   * List all titles with optional filtering
   */
  public async index({ request, response }: HttpContext) {
    try {
      const { search, lang, page = 1, limit = 12 } = request.qs();

      const trimmedSearch = search?.trim();

      let query = Title.query().preload("localizedNames");

      if (!trimmedSearch) {
        query = query.has("localizedNames");
      }

      if (trimmedSearch) {
        query = query.where((q) => {
          q.where("original_title", "LIKE", `%${trimmedSearch}%`).orWhereHas(
            "localizedNames",
            (lq) => {
              lq.where("localized_name", "LIKE", `%${trimmedSearch}%`);
            }
          );
        });
      }

      if (lang) {
        query = query.whereHas("localizedNames", (localizedQuery) => {
          localizedQuery.where("lang_id", lang);
        });
      }

      query.orderBy("updated_at", "desc");

      const titles = await query.paginate(page, limit);

      // Log IMDb data for titles that have it
      for (const title of titles) {
        if (title.imdbData) {
          console.log(
            `[TitlesController] IMDb data for title ${title.id} (${title.imdbId
            }): ${JSON.stringify(title.imdbData)}`
          );
        }
      }

      // Sempre retorna JSON (API)
      return response.json({
        success: true,
        data: titles,
      });
    } catch (error) {
      console.error(error);
      if (request.url().startsWith("/api")) {
        return response.status(500).json({
          success: false,
          message: "Error fetching titles",
          error: error.message,
        });
      }
      return response.status(500).send(error.message);
    }
  }

  /**
   * Store a new title with localized name
   */
  public async store({ request, response }: HttpContext) {
    try {
      const { originalTitle, imdbId, mediaType, langId, localizedName } = request.only([
        "originalTitle",
        "imdbId",
        "mediaType",
        "langId",
        "localizedName",
      ]);

      if (!originalTitle || !localizedName || !langId) {
        return response.status(400).json({
          success: false,
          message: "Original title, localized name, and language are required",
        });
      }

      // Create the title
      const title = await Title.create({
        imdbId: imdbId || `manual_${Date.now()}`,
        mediaType: mediaType || "tv",
        originalTitle: originalTitle.trim(),
      });

      // Create the localized name
      await LocalizedName.create({
        titleId: title.id,
        langId: langId,
        localizedName: localizedName.trim(),
      });



      return response.status(201).json({
        success: true,
        data: title,
      });
    } catch (error) {
      console.error("Error creating title:", error);
      return response.status(500).json({
        success: false,
        message: "Error creating title",
        error: error.message,
      });
    }
  }

  /**
   * Get localized names for a specific title (API only)
   */
  public async localizedNames({ params, response }: HttpContext) {
    try {
      const titleId = params.id;
      const localizedNames = await LocalizedName.query()
        .where("title_id", titleId)
        .preload("title");
      return response.json({
        success: true,
        data: localizedNames,
      });
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: "Error fetching localized names",
        error: error.message,
      });
    }
  }

  /**
   * Store a new localized name for a title
   */
  public async storeLocalizedName({ params, request, response }: HttpContext) {
    try {
      const titleId = params.id;
      const { localizedName, langId } = request.only(["localizedName", "langId"]);

      if (!localizedName || !langId) {
        return response.status(400).json({
          success: false,
          message: "Localized name and language ID are required",
        });
      }

      // Check if the title exists
      const title = await Title.find(titleId);
      if (!title) {
        return response.status(404).json({
          success: false,
          message: "Title not found",
        });
      }

      // Create the localized name
      const newLocalized = await LocalizedName.create({
        titleId: titleId,
        langId: langId,
        localizedName: localizedName.trim(),
      });


      // For API requests, return JSON
      return response.status(201).json({
        success: true,
        data: newLocalized,
      });
    } catch (error) {
      console.error("Error creating localized name:", error);
      return response.status(500).json({
        success: false,
        message: "Error creating localized name",
        error: error.message,
      });
    }
  }

  /**
   * Delete a title and its localized names
   */
  public async destroy({ params, response }: HttpContext) {
    try {
      const titleId = params.id;

      const title = await Title.find(titleId);
      if (title) {
        // Delete localized names first
        await LocalizedName.query().where("title_id", titleId).delete();
        // Delete title
        await title.delete();
      }

      return response.json({ success: true });
    } catch (error) {
      console.error(error);
      return response.status(500).json({
        success: false,
        message: "Error deleting title",
        error: error.message,
      });
    }
  }

  /**
   * Delete a specific localized name
   */
  public async destroyLocalizedName({ params, response }: HttpContext) {
    try {
      const localizedNameId = params.localizedNameId;
      console.log(
        `[TitlesController] Request to delete localized name: ${localizedNameId}`
      );

      const localizedName = await LocalizedName.find(localizedNameId);
      if (localizedName) {
        await localizedName.delete();
      }

      return response.json({ success: true });
    } catch (error) {
      console.error(error);
      return response.status(500).json({
        success: false,
        message: "Error deleting localized name",
        error: error.message,
      });
    }
  }

  /**
   * Clear all localized names
   */
  public async clearAll({ response }: HttpContext) {
    try {
      console.log("[titles_controller] Starting clearAll operation");

      // Count before delete
      const countBefore = await LocalizedName.query().count("* as total");
      console.log(
        `[titles_controller] Localized names before delete: ${(countBefore[0] as any).$extras.total
        }`
      );

      // Delete all localized names first
      const deleteResult = await LocalizedName.query().delete();
      console.log(`[titles_controller] Delete result:`, deleteResult);

      // Count after delete
      const countAfter = await LocalizedName.query().count("* as total");
      console.log(
        `[titles_controller] Localized names after delete: ${(countAfter[0] as any).$extras.total
        }`
      );

      // Preserve titles, only clear localizations as requested
      // await Title.query().delete()

      console.log("[titles_controller] ClearAll operation completed successfully");

      // Flash success message
      return response.json({
        success: true,
        message: `Cleared ${deleteResult} localized names from database.`,
      });
    } catch (error) {
      console.error("[titles_controller] Error in clearAll:", error);
      return response.status(500).json({
        success: false,
        message: "Failed to clear localized names.",
        error: error.message,
      });
    }
  }
}
