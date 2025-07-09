// deno-lint-ignore-file no-explicit-any
import { parse } from "jsr:@libs/xml";
import JSZip     from "npm:jszip";

/**
 * Read a text file from a ZIP archive
 * 
 * @param zip JSZip instance
 * @param filename Path to file in ZIP
 * @returns File content as string or null if not found
 */
async function readZipFile(zip: JSZip, filename: string): Promise<string | null> {
    const file = zip.files[filename];
    if (file && !file.dir) {
        return await file.async("text");
    }
    return null;
}

/**
 * Load and parse an EPUB file
 * @param epubBuffer ArrayBuffer containing EPUB data
 * @returns Parsed package document
 */
async function loadEpub(epubBuffer: ArrayBuffer): Promise<any> {
    const zip = new JSZip();
    const epubContent = await zip.loadAsync(epubBuffer);
    
    // Read the package document (usually in META-INF/container.xml first, then the OPF file)
    const containerXml = await readZipFile(epubContent, "META-INF/container.xml");
    if (!containerXml) {
        throw new Error("Invalid EPUB: Missing container.xml");
    }
    
    const container = parse(containerXml);
    const opfPath = (container as any)?.container?.rootfiles?.rootfile?.["@full-path"];
    if (!opfPath) {
        throw new Error("Invalid EPUB: Cannot find OPF file path");
    }
    
    const opfContent = await readZipFile(epubContent, opfPath);
    if (!opfContent) {
        throw new Error(`Invalid EPUB: Cannot read OPF file at ${opfPath}`);
    }
    
    return parse(opfContent);
}

/**
 * Extract and return the package document
 * 
 * @param input EPUB file as ArrayBuffer or package document as string
 * @returns JSON representation of the package document
 */
export async function getOPF(input: string | ArrayBuffer): Promise<any> {
    let package_document: any;
    
    if (input instanceof ArrayBuffer) {
        // Handle EPUB file
        package_document = await loadEpub(input);
    } else {
        // Handle XML string (existing functionality)
        package_document = parse(input) as any;
    }
    
    if (package_document === null) {
        throw new Error("Something went wrong with the conversion");
    }

    return package_document;
}

