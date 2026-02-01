"use strict";

/**
 * Lucide-React Compatibility Shim
 *
 * Re-exports all icons from lucide-react and adds CloudUpload alias
 * for compatibility with @privy-io/react-auth which uses the old icon name.
 *
 * CloudUpload was renamed to Upload in lucide-react v0.300+
 */

const lucide = require("lucide-react-original");

// Re-export everything from the original lucide-react
module.exports = {
  ...lucide,
  // Add CloudUpload as alias for Upload (renamed in v0.300+)
  CloudUpload: lucide.Upload || lucide.CloudArrowUp || lucide.Cloud,
};
