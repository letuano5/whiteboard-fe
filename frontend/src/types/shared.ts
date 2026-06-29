// Single source of truth lives in the workspace package `@vdt/shared`
// (packages/shared). Re-exported here so existing relative imports
// (`../types/shared`) keep working unchanged across the frontend.
export * from '@vdt/shared';
