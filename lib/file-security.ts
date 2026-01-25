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
 * Security warning message for file transfers
 */
export const FILE_TRANSFER_WARNING = `
Security Notice:
- Always scan downloaded files with antivirus software before opening
- Be cautious of archive files (.zip, .rar) - extract and scan contents
- Never run executable files from untrusted sources
- If a file behaves unexpectedly, do not proceed and contact support
`;
