// deno-lint-ignore-file no-explicit-any
import type { Json } from "./common.ts";





function toArray(input: any | [any]): any[] {
    return Array.isArray(input) ? input : [input]
}

// For objects with arrays, a function to possibly
// create the array on the fly for a member
function addValue(obj: any, name: string, value: any) {
    if (name in obj) {
        obj[name].push(value);
    } else {
        obj[name] = [value]
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
    const metas: any[] = toArray(opf.package.metadata["meta"]);

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
        // Creators. The (possible) refinement in the OPF should
        // be used to choose among the properties listed in the PM
        // Caveat (TBD): the mapping from the role value in the OPF file is mechanical; in theory, it should be checked
        // against the predefined roles.
        const roles: any = {};
        const creators: any[] = toArray(opf.package.metadata["dc:creator"]);
        if (creators.length > 0) {
            const refines = metas.filter((entry: any): boolean => {
                    const ref  = entry["@refines"] || false;
                    const role = entry["@property"] && entry["@property"] === "role";
                    return ref && role;
                });
            for (const person of creators) {
                if (typeof(person) === "string" || !("@id" in person)) {
                    // We have no choice then take a default:
                    addValue(roles, "author", person)
                } else {
                    // Let us see if there is a refinement
                    for (const refine of refines) {
                        if (refine["@refines"] === `#${person["@id"]}`) {
                            const role = refine["#text"];
                            addValue(roles, role, person)
                        }
                    }
                }
            }
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
    }



    return output;
}
