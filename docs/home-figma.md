# Figma discovery page

Reference: https://www.figma.com/design/zutnbg8hxggQjNZc4sqyn0?node-id=428-1840

The page uses the existing catalog API, normalized game objects and useCatalogResource hook. Authentication, cart, wishlist, API configuration and deployment are unchanged. Empty or failed backend responses never fall back to demo games.

The populated desktop layout is 1440 × 6005. The first two discover sections occupy the discovery and sale rows; remaining sections follow the rankings. Other slots use featured, promos, deals, free_games, mobile_banner and ranked_columns from GET /discover/discover.

Optional presentation metadata:
- featured_image_url, featured_subtitle, featured_crop on the featured game; featured_crop enables the reference artwork's crop.
- A banner with banner_type: featured_panel supplies the side-panel background.
- Image media supplies up to two featured screenshots.
- availability and free_soon label free-game offers; release_label labels upcoming titles.
- Section/column game_overrides[gameId].image_url supports alternate artwork for the same product ID.
- Promos use title, description, image_url and link. The mobile banner accepts image_url or image.

All game IDs, images, prices and discounts remain API-supplied. Percentages are calculated from the real original/current prices, rather than copying inconsistent percentages in the reference. Pagination retains the existing 25-item lookahead for 24 visible games and preserves tag filters in the URL. All games and View More open usable catalog views instead of displaying fictitious page totals.

Run node scripts/test-discover.mjs for mocked-API browser verification of the full layout, images, 390/768/1024 px overflow, pagination, tags, free-game browsing, product navigation, empty responses and error retry. The fixture in scripts/fixtures/discover.json is local-only, ignored by Git and never imported by the application. Supply it locally to run this optional check; without it the script reports SKIP and runs no tests. Screenshots are written to ignored qa-artifacts/.
