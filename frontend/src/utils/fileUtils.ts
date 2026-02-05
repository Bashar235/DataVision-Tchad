/**
 * Sanitizes a filename by removing characters that are invalid across most file systems.
 * invalid characters: / \ : * ? " < > |
 */
export const sanitizeFilename = (filename: string): string => {
    return filename.replace(/[\\/*?:"<>|]/g, "").trim();
};

/**
 * Downloads a blob as a file with the given filename.
 */
export const downloadFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
