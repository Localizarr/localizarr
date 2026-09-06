import { BaseCommand, flags } from "@adonisjs/core/ace";
import { CommandOptions } from "@adonisjs/core/types/ace";
import ImdbImportSeeder from "../database/seeders/imdb_import_seeder.js";
import * as fs from "node:fs";
import * as path from "node:path";

export default class ForceImportTitles extends BaseCommand {
  static commandName = "import:titles:force";
  static description =
    "Force download and re-import IMDb titles data (deletes existing data and optionally downloads fresh TSV)";

  static options: CommandOptions = {
    startApp: true,
  };

  @flags.boolean({ alias: "y", description: "Skip confirmation prompt" })
  declare confirm: boolean;

  async run() {
    this.logger.info("🎬 Starting forced IMDb titles import...");

    if (!this.confirm) {
      const confirmed = await this.prompt.confirm(
        "⚠️  This will DELETE all existing titles and re-import from IMDb. Continue?"
      );

      if (!confirmed) {
        this.logger.info("❌ Operation cancelled by user.");
        return;
      }
    }

    // Ask about downloading fresh TSV file
    const downloadFresh = await this.prompt.confirm(
      "📥 Download fresh TSV file from IMDb? (Deletes existing file if present)"
    );

    if (downloadFresh) {
      const filePath = path.join(process.cwd(), "tmp", "title.basics.tsv.gz");
      if (fs.existsSync(filePath)) {
        this.logger.info("🗑️  Deleting existing TSV file...");
        this.logger.info(`📂 File: ${filePath}`);
        fs.unlinkSync(filePath);
        this.logger.info("✅ Existing TSV file deleted.");
      }
      this.logger.info("📥 Will download fresh TSV file from IMDb.");
    } else {
      this.logger.info("⏭️  Using existing TSV file (if available).");
    }

    try {
      // Delete existing titles
      this.logger.info("🗑️  Deleting existing titles...");
      const { default: Title } = await import("#models/title");
      await Title.query().delete();
      this.logger.info("✅ Existing titles deleted.");

      // Execute the IMDb import seeder
      this.logger.info("📥 Starting fresh import...");
      // Corrigir: passar o QueryClientContract correto se necessário
      const seeder = new ImdbImportSeeder(await import('@adonisjs/lucid/database'));
      await seeder.run();

      this.logger.success("✅ Forced IMDb titles import completed successfully!");
    } catch (error) {
      this.logger.error("❌ Forced IMDb titles import failed:", error.message);
      throw error;
    }
  }
}
