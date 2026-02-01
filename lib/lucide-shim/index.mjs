/**
 * Lucide-React Compatibility Shim (ESM)
 *
 * Re-exports all icons from lucide-react and adds CloudUpload alias
 * for compatibility with @privy-io/react-auth which uses the old icon name.
 */

export * from "lucide-react-original";
import { Upload, CloudArrowUp, Cloud } from "lucide-react-original";

// Add CloudUpload as alias for Upload (renamed in v0.300+)
export const CloudUpload = Upload || CloudArrowUp || Cloud;
