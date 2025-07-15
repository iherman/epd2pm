// deno-lint-ignore-file no-explicit-any

const propertyMappings: Record<string,string> = {
    "cover-image"      : "cover",
    "mathml"           : "",
    "nav"              : "content",
    "remote-resources" : "",
    "scripted"         : "",
    "svg"              : "",
};

const schemaRoles: Record<string,string> = {
    "artist"      : "artist",
    "author"      : "author",
    "colorist"    : "colorist",
    "contributor" : "contributor",
    "creator"     : "creator",
    "editor"      : "editor",
    "illustrator" : "illustrator",
    "inker"       : "inker", 
    "letterer"    : "letterer",
    "penciler"    : "penciler",
    "publisher"   : "publisher",
    "readBy"      : "readBy",
    "translator"  :"translator",   
}

const marcRoles: Record<string, string> = {
    "art" : "artist",
    "aut" : "author",
    "clr" : "colorist",
    "ctb" : "contributor",
    "cre" : "creator",
    "edt" : "editor",
    "ill" : "illustrator",
    "ink" : "inker",
    "ltr" : "letterer",
    "pnc" : "penciler",
    "pbl" : "publisher",
    "spk" : "readBy",
    "trl" : "translator",
}

// export type Json = any;

type JsonPrimitive = string | boolean | number ;
interface JsonObject {
    [key: string]: Json;
}
export type Json = JsonPrimitive | JsonObject | Json[];

/**
 * Make sure that the result is always an array (for an easier handling)
 * 
 * @param input 
 * @returns 
 */
function toArray(input: any | [any]): any[] {
    if (input === undefined) {
        return [];
    } else {
        return Array.isArray(input) ? input : [input];
    }
}

/**
 * For statement values as arrays, a function to possibly create the array on the fly for a member
 * 
 * @param obj 
 * @param name 
 * @param value 
 */
function addValue(obj: any, name: string, value: any) {
    if (name in obj) {
        obj[name].push(value);
    } else {
        obj[name] = [value]
    }
}

/**
 * Copy a single OPF value, if it exists, to the PM
 * 
 * @param opf 
 * @param opfName 
 * @param pm 
 * @param pmName 
 */
function copySingleValue(opf: any, opfName: string, pm: Json, pmName: string) {
    const values = toArray(opf.package.metadata[opfName]);
    if (values.length !== 0) {
        (pm as JsonObject)[pmName] = values[0];
    }
}

/**
 * Copy a single OPF meta value, if it exists, to the PM
 * 
 * @param metas 
 * @param opfName 
 * @param pm 
 * @param pmName 
 */
function copySingleMetaValue(metas: any[], opfName: string, pm: Json, pmName: string) {
    const value = metas.find((meta: any): boolean => {
        return "@property" in meta && meta["@property"] === opfName
    });        
    if (value) {
        (pm as JsonObject)[pmName] = value["#text"];
    }
}

export function convert(opf: any, trace = false): Json {
    if (trace) {
        console.log(JSON.stringify(opf, null, 4));
    }
    const output: Json = {
        "@context": [
            "https://schema.org",
            "https://www.w3.org/ns/pub-context"
        ],
    };

    const metas: any[]    = toArray(opf.package.metadata["meta"]);
    const manifest: any[] = toArray(opf.package.manifest["item"]);
    const spine: any[]    = toArray(opf.package.spine["itemref"]);

    {
        // extract ID values: one for the real id, others as references.
        // find the unique identifier. Per epubcheck, that must exist,
        // and corresponds to one single dc:identifier occurrence.
        //
        // Caveat: the OPF spec does not require URLs, 
        // the PM does. Ie, the generated PM might not be correct.
        const uid = opf.package["@unique-identifier"];
        if (uid) {
            const ids: any[] = toArray(opf.package.metadata["dc:identifier"]);
            const urls: string[] = [];
            for (const id of ids) {
                if (id["@id"] === uid) {
                    output.id = id["#text"];
                } else {
                    urls.push(id["#text"]);
                }
            }
            if (urls.length > 0) {
                output.url = urls;
            }
        }
    }

    {
        // Simple copy of values of some core metadata
        copySingleValue(opf, "dc:title", output, "name");
        copySingleValue(opf, "dc:date", output, "datePublished");
        copySingleMetaValue(metas, "dcterms:modified", output, "dateModified");
        copySingleValue(opf, "dc:language", output, "inLanguage");
    }

    {
        // progression direction
        if ("@page-progression-direction" in opf.package.spine) {
            output.readingProgression = opf.package.spine["@page-progression-direction"];
        }
    }

    {
        // Creators/contributors. The (possible) refinement in the OPF should
        // be used to choose among the properties listed in the PM
        // At the moment, two schemes are recognized: the default set of roles
        // defined for the publ manifest, which corresponds to schema.org,
        // and the marc:relators that have an equivalence with manifests
        // In the case there is no match, the 'creator' and 'contributor' roles
        // are used.
        const roles: any = {};
        const creators: any[] = toArray(opf.package.metadata["dc:creator"]);
        const contributors: any[] = toArray(opf.package.metadata["dc:contributor"]);
        const refines = metas.filter((entry: any): boolean => {
            const ref = entry["@refines"] || false;
            const role = entry["@property"] && entry["@property"] === "role";
            return ref && role;
        });

        const collectRoles = (persons: string[], base: string): void => {
            if (persons.length > 0) {
                for (const person of persons) {
                     if (typeof (person) === "string" || !("@id" in person)) {
                        // We have no choice then take a default:
                        addValue(roles, base, person);
                    } else {
                        // Let us see if there is a refinement
                        for (const refine of refines) {
                            if (refine["@refines"] === `#${person["@id"]}`) {
                                // Decide which term scheme is used.
                                // default is schema.org, the other possibility is the (shortened) mark list;
                                const scheme  = ((): Record<string,string> => {
                                    if ("@scheme" in refine) {
                                        return refine["@scheme"] === "marc:relators" ? marcRoles : schemaRoles;
                                    } else {
                                        return schemaRoles;
                                    }
                                })();
                                // In theory, refine["#text"] may be undefined, but we rely on epubcheck filtering this out.
                                const role = scheme[refine["#text"]] || base ;
                                addValue(roles, role, person);
                            }
                        }
                    }
                }
                   
            }
        };
        collectRoles(creators, "creator");
        collectRoles(contributors, "contributor");

        // Add the creators to the output
        for (const role in roles) {
            const persons = roles[role].map((person: any): any => {
                return {
                    type : "Person",
                    name: typeof person === "string" ? person : person["#text"]
                }
            });
            output[role] = persons.length === 1 ? persons[0] : persons ;
        }
    }

    {
        // Collect reading order entries and resources, combining the spine and manifest entries
        const createResource = (item: any): Json => {
            // Make it simple for the usual cases
            if (!("@properties" in item) &&
                ["application/xhtml+xml", "text/html"].includes(item["@media-type"])) {
                return item["@href"];
            } else {
                const value: Json = {
                    "type"           : "LinkedResource",
                    "url"            : item["@href"],
                    "encodingFormat" : item["@media-type"],
                };

                if ("@properties" in item) {
                    const properties: string[] = item["@properties"].split(" ");
                    const rel =properties.map((prop: string): string => {
                        return propertyMappings[prop] || "";
                    }).join(' ').trim();
                    if (rel !== "") {
                        value["rel"] = rel;
                    }
                }
                return value;
            }
        };

        // Establishing the reading order
        const readingOrder = [];
        const resources    = [];

        for (const spineItem of spine) {
            const ref = spineItem["@idref"];
            // Find the right manifest entry
            const entry = manifest.find((item: any): boolean => {
                return ref === item["@id"];
            })

            if (entry) {
                // Make it simple for the usual cases
                readingOrder.push(createResource(entry));
                entry.done = true
            }
        }
        output.readingOrder = readingOrder;

        // list the leftover resources
        const leftover = manifest.filter((item: any): boolean => {
            return item.done === undefined
        });

        if (leftover.length > 0) {
            for(const item of leftover) {
                resources.push(createResource(item));
            }
            output.resources = resources;
        }
    }

    return output;
}
