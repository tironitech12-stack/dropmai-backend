import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.types';
import { StoresService } from '../stores/stores.service';
import { THEME_CATALOG } from './theme-catalog';

/**
 * Dedicated themes surface so gallery/apply stay reachable even if an older
 * StoresController build is missing the theme routes (Render lag).
 */
@Controller('api/v1')
export class ThemesController {
  constructor(private readonly stores: StoresService) {}

  @Get('themes')
  listThemes() {
    return {
      themes: this.stores.listThemes(),
      count: THEME_CATALOG.length,
      catalogVersion: 'thematic-v2',
    };
  }

  /** Alternate apply path (same auth + body as stores/:id/theme/apply). */
  @Post('themes/:themeId/apply')
  @UseGuards(AuthGuard)
  async applyByTheme(
    @Req() req: { user: SessionUser },
    @Param('themeId') themeId: string,
    @Body() body: { storeId?: string; keepCustomBrand?: boolean },
  ) {
    if (!body.storeId?.trim()) {
      throw new BadRequestException('storeId obrigatório');
    }
    const store = await this.stores.applyTheme(
      body.storeId.trim(),
      req.user,
      themeId.trim(),
      body.keepCustomBrand !== false,
    );
    return { store };
  }
}
