// Mock for sharp module — @xenova/transformers imports sharp for image processing,
// but we only use the text/feature-extraction pipeline which doesn't need image support.
// This mock provides a null default export so the module loads without native binaries.
module.exports = null;
module.exports.default = null;
