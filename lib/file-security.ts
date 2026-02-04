/**
 * File Security Utilities
 *
 * Validates file types and provides security warnings for potentially dangerous files.
 */

// Dangerous file extensions that should be blocked
export const BLOCKED_EXTENSIONS = [
  // Windows executables
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe', '.js', '.jse',
  '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.ps1xml', '.ps2', '.ps2xml', '.psc1', '.psc2',
  '.msh', '.msh1', '.msh2', '.mshxml', '.msh1xml', '.msh2xml', '.reg',
  // macOS executables
  '.app', '.dmg', '.pkg', '.command',
  // Linux executables
  '.sh', '.bin', '.run', '.deb', '.rpm',
  // Other dangerous types
  '.dll', '.sys', '.drv', '.ocx', '.cpl', '.inf',
  '.hta', '.jar', '.class',
  // Potentially dangerous documents
  '.docm', '.xlsm', '.pptm', // Macro-enabled Office files
  '.lnk', '.url', // Shortcut files
  '.iso', '.img', // Disk images
];

// File extensions that warrant a warning (but are allowed)
export const WARNING_EXTENSIONS = [
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', // Archives (could contain anything)
  '.pdf', // Can contain malicious scripts
  '.doc', '.xls', '.ppt', // Old Office formats
];

// Safe file extensions for code and assets
export const SAFE_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp',
  // Documents
  '.txt', '.md', '.csv', '.rtf',
  // Modern Office (without macros)
  '.docx', '.xlsx', '.pptx',
  // Code files
  '.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.scss', '.less',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h',
  '.php', '.sql', '.yaml', '.yml', '.toml', '.xml', '.env.example',
  // Config files
  '.gitignore', '.npmrc', '.prettierrc', '.eslintrc',
  // Fonts
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
];

export interface FileValidationResult {
  allowed: boolean;
  warning: boolean;
  message: string;
  extension: string;
}

/**
 * Validate a file for security concerns
 */
export function validateFile(filename: string): FileValidationResult {
  const extension = getExtension(filename).toLowerCase();

  // Check if blocked
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return {
      allowed: false,
      warning: false,
      message: `File type "${extension}" is not allowed for security reasons. Executable files cannot be uploaded.`,
      extension,
    };
  }

  // Check if warning needed
  if (WARNING_EXTENSIONS.includes(extension)) {
    return {
      allowed: true,
      warning: true,
      message: `Warning: "${extension}" files can potentially contain malicious content. The buyer should scan this file before opening.`,
      extension,
    };
  }

  // File is safe
  return {
    allowed: true,
    warning: false,
    message: 'File type is allowed',
    extension,
  };
}

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot);
}

/**
 * Check if a file is an image
 */
export function isImageFile(filename: string): boolean {
  const extension = getExtension(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp'].includes(extension);
}

/**
 * Check if a file is a code/text file
 */
export function isCodeFile(filename: string): boolean {
  const extension = getExtension(filename).toLowerCase();
  return SAFE_EXTENSIONS.includes(extension);
}

/**
 * Get security level for display
 */
export function getSecurityLevel(filename: string): 'safe' | 'warning' | 'blocked' {
  const result = validateFile(filename);
  if (!result.allowed) return 'blocked';
  if (result.warning) return 'warning';
  return 'safe';
}

/**
 * Validate MIME type against allowed types
 */
export function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}

/**
 * Magic bytes (file signatures) for common file types
 * Used to verify actual file content matches claimed extension
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  // Images
  '.jpg': [[0xFF, 0xD8, 0xFF]],
  '.jpeg': [[0xFF, 0xD8, 0xFF]],
  '.png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  '.gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP uses RIFF container)
  '.bmp': [[0x42, 0x4D]],
  '.ico': [[0x00, 0x00, 0x01, 0x00], [0x00, 0x00, 0x02, 0x00]],
  // Documents
  '.pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  // Archives
  '.zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
  '.rar': [[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07]],
  '.7z': [[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]],
  '.gz': [[0x1F, 0x8B]],
  '.tar': [[0x75, 0x73, 0x74, 0x61, 0x72]], // "ustar" at offset 257
  // Office documents (OOXML)
  '.docx': [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based
  '.xlsx': [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based
  '.pptx': [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based
  // Old Office format (OLE compound)
  '.doc': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  '.xls': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  '.ppt': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
};

export interface MagicByteValidationResult {
  valid: boolean;
  message: string;
  expectedSignature?: string;
  actualSignature?: string;
}

/**
 * Validate file content against magic bytes
 * Prevents extension spoofing (e.g., .exe renamed to .jpg)
 *
 * @param buffer First 16+ bytes of the file
 * @param extension Claimed file extension
 * @returns Validation result
 */
export function validateMagicBytes(buffer: Buffer | Uint8Array, extension: string): MagicByteValidationResult {
  const ext = extension.toLowerCase();
  const signatures = MAGIC_BYTES[ext];

  // If we don't have signatures for this extension, allow it
  // (text files, code files, etc. don't have magic bytes)
  if (!signatures) {
    return {
      valid: true,
      message: 'No magic byte signature defined for this file type',
    };
  }

  // Check each possible signature for this extension
  for (const signature of signatures) {
    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return {
        valid: true,
        message: 'File content matches expected signature',
      };
    }
  }

  // Convert bytes to hex string for debugging
  const actualHex = Array.from(buffer.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  const expectedHex = signatures[0]
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');

  return {
    valid: false,
    message: `File content does not match expected ${ext} signature. Possible extension spoofing detected.`,
    expectedSignature: expectedHex,
    actualSignature: actualHex,
  };
}

/**
 * Comprehensive file validation including magic bytes
 */
export async function validateFileComprehensive(
  file: File | { name: string; buffer: Buffer | Uint8Array }
): Promise<FileValidationResult & { magicByteCheck?: MagicByteValidationResult }> {
  // First check extension
  const filename = 'name' in file ? file.name : '';
  const extensionResult = validateFile(filename);

  if (!extensionResult.allowed) {
    return extensionResult;
  }

  // Then check magic bytes if we have the buffer
  const ext = getExtension(filename).toLowerCase();
  if (MAGIC_BYTES[ext] && 'buffer' in file) {
    const magicResult = validateMagicBytes(file.buffer, ext);
    if (!magicResult.valid) {
      return {
        ...extensionResult,
        allowed: false,
        warning: false,
        message: magicResult.message,
        magicByteCheck: magicResult,
      };
    }
    return {
      ...extensionResult,
      magicByteCheck: magicResult,
    };
  }

  return extensionResult;
}

/**
 * Security warning message for file transfers
 */
export const FILE_TRANSFER_WARNING = `
Security Notice:
- Always scan downloaded files with antivirus software before opening
- Be cautious of archive files (.zip, .rar) - extract and scan contents
- Never run executable files from untrusted sources
- If a file behaves unexpectedly, do not proceed and contact support
`;
