
import { getOPF }         from "./lib/getOPF.ts";
import { convert, Json }  from "./lib/convertOPF.ts";
import { parseArgs }      from "jsr:@std/cli/parse-args";


async function main(): Promise<void> {
    const args = parseArgs(Deno.args, {
        string: ["output", "o"],
        boolean: ["help", "version", "trace"],
        alias: { o: "output", h: "help", v: "version", t: "trace" },
    });

    if (args.help) {
        console.log(`
epd2pm v1.0.0
Convert an EPUB OPF file into a Publication Manifest

Usage: deno run -A main.ts [options] <fname>

Options:
  -o, --output <fname>  Output file name. If missing, standard output is used
  -h, --help           Show this help message
  -v, --version        Show version number
        `);
        return;
    }

    if (args.version) {
        console.log("epd2pm v1.0.0");
        return;
    }

    if (args._.length === 0) {
        console.error("No file name has been provided; exiting");
        console.error("Use --help for usage information");
        Deno.exit(1);
    } else {
        const fname: string = args._[0] as string;

        const file = await (async (): Promise<string | ArrayBuffer> => {
            if(fname.endsWith(".opf") || fname.endsWith(".xml")) {
                return await Deno.readTextFile(fname);
            } else if(fname.endsWith(".epub")) {
                return (await Deno.readFile(fname)).buffer;
            } else {
                throw new Error(`Unsupported file type: ${fname}. Supported formats: .opf, .xml, .epub`);
            }
        })();

        const opf: any = await getOPF(file);
        const pm: Json = convert(opf, args.trace || false);

        const output = JSON.stringify(pm, null, 4);
        if (args.output) {
            await Deno.writeTextFile(args.output, output);
        } else {
            console.log(output);
        }
    }
}

await main();



