// deno-lint-ignore-file no-explicit-any
import type { Json } from "./common.ts";


function toArray(input: any | [any]): any[] {
    return Array.isArray(input) ? input : [input]
}



export function convert(opf: any): Json {
    const output: Json = {
        "@context": [
            "https://schema.org",
            "https://www.w3.org/ns/pub-context"
        ],
    };

    {
        // extract ID value
        // find the unique identifier. Per epubcheck, that must exist
        const uid = opf.package["@unique-identifier"];
        if (uid) {
            const ids: any[] = toArray(opf.package.metadata["dc:identifier"]);
            for (const id of ids) {
                if (id["@id"] === uid) {
                    output.id = id["#text"];
                    break;
                }
            }
        }
    }

    return output;
}
