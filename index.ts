/* tslint:disable-next-line */
const parser = require("./parser.js");
import { Promise } from "es6-promise";
import * as fs from "mz/fs";
import * as path from "path";

export interface Interface {
    moduleName: string;
    interface: any;
}

export interface ExportInterface {
    moduleName: string;
    exports: any;
}

function getExports(parsedData: any): any {
    const exportedThings = parsedData.exports.map((exportThing: any) => exportThing.name);

    return parsedData.types.filter(((type: any) => exportedThings.indexOf(type.name) > -1));
}

function getPackageInfo(elmPackagePath: string): any {
    return fs.readFile(elmPackagePath, "utf-8").then((elmPackageAsString: string) => {
        const elmPackage = JSON.parse(elmPackageAsString);

        const withoutGithub = elmPackage.repository.replace("https://github.com/", "");
        const withDotGit = withoutGithub.replace(".git", "");

        const splitted = withDotGit.split("/");

        return {
            name: splitted[0],
            package: splitted[1],
            version: elmPackage.version,
        };
    });
}

function elmStuffPath(packageInfo: any, elmVersion: string): string {
    return path.join(
        "elm-stuff",
        "build-artifacts",
        elmVersion,
        packageInfo.name,
        packageInfo.package,
        packageInfo.version,
    );
}

export function getAllInterfaces(pathToRead: string, elmVersion: string): Promise<Interface[]> {
    return getPackageInfo(path.join(pathToRead, "elm-package.json"))
        .then((packageInfo: any) => {
            const buildPath = path.join(pathToRead, elmStuffPath(packageInfo, elmVersion));
            return fs.readdir(buildPath).then((files: string[]) => {
                return {
                    buildPath,
                    files: files.filter((name) => name.indexOf(".elmi") > 0),
                };
            });
        })
        .then((buildStuff: any) => {
            const filenames = buildStuff.files;

            const promises = filenames.map((filename: string) => {
                return fs.readFile(path.join(buildStuff.buildPath, filename)).then((fileData: any) => {
                    const parsedData = parser.parse(fileData);
                    const withoutElmi = filename.substr(0, filename.indexOf("."));
                    const withDots = withoutElmi.split("-").join(".");
                    return {
                        interface: parsedData,
                        moduleName: withDots,
                    };
                });
            });

            return Promise.all(promises);
        });
}

export function getExportedInterfaces(pathToRead: string, elmVersion: string): Promise<ExportInterface[]> {
    return getPackageInfo(path.join(pathToRead, "elm-package.json"))
        .then((packageInfo: any) => {
            const buildPath = path.join(pathToRead, elmStuffPath(packageInfo, elmVersion));
            return fs.readdir(buildPath).then((files) => {
                return {
                    buildPath,
                    files: files.filter((name) => name.indexOf(".elmi") > 0),
                };
            });
        })
        .then((buildStuff: any) => {
            const filenames = buildStuff.files;

            const promises = filenames.map((filename: string) => {
                return fs.readFile(path.join(buildStuff.buildPath, filename)).then((fileData) => {
                    const parsedData = parser.parse(fileData);
                    const withoutElmi = filename.substr(0, filename.indexOf("."));
                    const withDots = withoutElmi.split("-").join(".");
                    return {
                        exports: getExports(parsedData),
                        moduleName: withDots,
                    };
                });
            });

            return Promise.all(promises);
        });
}


fs.readFile("example/elm-stuff/build-artifacts/0.18.0/user/project/1.0.0/Main.elmi").then((data) => {
    //console.log(data);

    // Elm VERSION is encoded as three ints, 8 bytes long each 
    
    let offset = 0;
    const majorVersion = data.readUIntBE(offset, 8);
    
    offset += 8;
    const minorVersion = data.readUIntBE(offset, 8);
    
    offset += 8;
    const patchVersion = data.readUIntBE(offset, 8);
    
    offset += 8;
    const userNameLength = data.readUIntBE(offset, 8);
    
    offset += 8;
    const packageUserInfo = data.slice(offset, offset + userNameLength).toString();
    offset += userNameLength;

    const repoNameLength = data.readUIntBE(offset, 8); 
    offset += 8;

    const repoName = data.slice(offset , offset + repoNameLength).toString();

    offset += repoNameLength;


    const numberOfExports = data.readUIntBE(offset, 8);
    offset += 8;


    const ourExports = [];
    const ourImports = [];

    for (let i = 0; i < numberOfExports; i++){
        let exportType = data.readUIntBE(offset, 1);
        offset += 1;

        let exportItemNameLength = data.readUIntBE(offset, 8);
        offset += 8;
        let exportItemName = data.slice(offset, offset + exportItemNameLength).toString();
        offset += exportItemNameLength;

        if (exportType === 0) {
            ourExports.push( {name: exportItemName, exportType: { kind: "value"} });
        } else if (exportType === 1) {
            ourExports.push( {name: exportItemName, exportType: { kind: "alias"} });
        } else {
            // TODO
        }
    }

    const numberOfImports = data.readUIntBE(offset, 8);
    offset += 8;

    for (let i = 0; i < numberOfImports; i++){
        let numberOfDots = data.readUIntBE(offset, 8);
        offset += 8;

        let fullImportName = [];

        for (let j = 0; j < numberOfDots; j++){
            let importNameLength = data.readUIntBE(offset, 8);
            offset += 8;

            let importItemName = data.slice(offset, offset + importNameLength).toString();
            offset += importNameLength;
            fullImportName.push(importItemName);
        }

        ourImports.push(fullImportName);
    }








    const numberOfTypes = data.readUIntBE(offset, 8);
    offset += 8;


    console.log('number of types', numberOfTypes);
    let ourTypes = [];
    for (let i = 0; i < numberOfTypes; i++){
        let varNameLength = data.readUIntBE(offset, 8);
        offset += 8;

        let varName = data.slice(offset, offset + varNameLength).toString();
        offset += varNameLength;

        let currentPass = decodeType(data, offset);

        offset = currentPass.offset;
        ourTypes.push(currentPass.item);
    }

    // TODO: unions, aliases, fixities


    console.log("Firest version", majorVersion, minorVersion, patchVersion);

    console.log("package", packageUserInfo, repoName);
    console.log('number of exports', numberOfExports);
    console.log('exports:', ourExports);
    console.log("imports: ", ourImports);
    console.log("types", ourTypes.map((x) => JSON.stringify(x)));
});

interface OffsetItem<T>{
    item: T;
    offset: number;
} 

function decodeType(buffer: Buffer, offset: number) : OffsetItem<Canonical> {
    let varTypeAsInt = buffer.readUInt8(offset);
    offset += 1;

    let varType = typeIntToCanonical(varTypeAsInt);

    switch (varType) {
        case 'lambda': {
            let left = decodeType(buffer, offset);
            offset = left.offset;

            let right = decodeType(buffer, offset);
            
            offset = right.offset;

            return {
                item: {kind:'lambda', left: left.item, right: right.item },
                offset: offset
            };
        } 
        case 'var': {
            let nameLength = buffer.readUIntBE(offset, 8);
            offset += 8;
            let name = buffer.slice(offset, offset + nameLength).toString();
            offset += nameLength;

            return { item: { kind: 'var', name: name }, offset: offset };
        }
        case 'type': {
            let canVarInfo = decodeCanonicalVariable(buffer, offset);

            offset = canVarInfo.offset;

            return {
                item: {kind: 'type', var: canVarInfo.item },
                offset: offset
            };
        }
        case 'app': {
            let left = decodeType(buffer, offset);
            offset = left.offset;

            let numberOfRights = buffer.readUIntBE(offset, 8);
            offset += 8;
            let rights = [];

            for (let i = 0; i < numberOfRights; i++){
                let right = decodeType(buffer, offset);
                offset = right.offset;
                rights.push(right.item);
            }

            return {
                item: { kind: 'app', left: left.item, right: rights },
                offset: offset
            };
        }
        case 'record' : {
            throw "record";
        }
        case 'aliased' : {
            let canVarInfo = decodeCanonicalVariable(buffer, offset);

            offset = canVarInfo.offset;

            console.log(canVarInfo);
            console.log('reading at', offset.toString(16));
            let numberOfFields = buffer.readUIntBE(offset, 8);
            offset += 8;

            console.log('index', offset.toString(16))
            console.log('number of fields?', numberOfFields)

            let fields : RecordField[] = [];
            for (let i = 0; i < numberOfFields; i++){
                let nameLength = buffer.readUIntBE(offset, 8);
                offset += 8;

                let name = buffer.slice(offset, offset + nameLength).toString();
                offset += nameLength;

                let fieldType = decodeType(buffer, offset);
                offset = fieldType.offset;
                fields.push({ kind: "recordField", name: name, type: fieldType.item});
            }

            return {
                item: {kind: 'aliased', fields: fields, filled: true },
                offset: offset
            }
        }
    }
    throw "var type? " + varTypeAsInt;
} 

interface RecordField {
    kind: "recordField";
    name: string;
    type: Canonical;
};

function decodeModuleName(buffer: Buffer, offset: number) {
    let homeLength = buffer.readUIntBE(offset, 8);
    offset += 8;

    let home = buffer.slice(offset, offset + homeLength).toString();
    offset += homeLength;

    let nameLength = buffer.readUIntBE(offset, 8);
    offset += 8;

    let name = buffer.slice(offset, offset + nameLength).toString();
    offset += nameLength;

    return { 
        offset: offset,
        moduleName: {
            name: name,
            home: home
        }
    };
};

function decodeCanonicalVariable(buffer : Buffer, offset: number) : OffsetItem<CanonicalVariable> {
    let canonicalType = buffer.readUInt8(offset);
    console.log('Read type', canonicalType, "at", offset.toString(16));
    offset += 1;


    switch (canonicalType) {
        case 0: {
            let builtInNameLength = buffer.readUIntBE(offset, 8);
            offset += 8;

            let builtInName = buffer.slice(offset, offset + builtInNameLength).toString();
            offset += builtInNameLength;

            return {
                item: { kind: "builtIn", name: builtInName},
                offset: offset
            };
        }

        case 1: {
            let moduleInfo = decodeModuleName(buffer, offset);

            let moduleName = moduleInfo.moduleName;
            offset = moduleInfo.offset;

            let pathLength = buffer.readUIntBE(offset, 8);
            offset += 8;

            let path = [];

            for (let i = 0; i < pathLength + 1; i++){
                let pathPartLength = buffer.readUIntBE(offset, 8);
                offset += 8;

                let pathPart = buffer.slice(offset, offset + pathPartLength).toString();
                offset += pathPartLength;

                path.push(pathPart);
            }

            return {
                item: { kind: "module", name: moduleName, path: path},
                offset: offset
            };
        }

        case 2: {
            let moduleInfo = decodeModuleName(buffer, offset);

            let moduleName = moduleInfo.moduleName;
            offset = moduleInfo.offset;

            let pathLength = buffer.readUIntBE(offset, 8);
            offset += 8;

            let path = [];

            for (let i = 0; i < pathLength + 1; i++){
                let pathPartLength = buffer.readUIntBE(offset, 8);
                offset += 8;

                let pathPart = buffer.slice(offset, offset + pathPartLength).toString();
                offset += pathPartLength;

                path.push(pathPart);
            }

            return {
                item: { kind: "topLevel", name: moduleName, path: path},
                offset: offset
            };
        }

        case 3: {
            let localNameLength = buffer.readUIntBE(offset, 8);
            offset += 8;

            let localName = buffer.slice(offset, offset + localNameLength).toString();
            offset += localNameLength;

            return {
                item: { kind: "local", name: localName},
                offset: offset
            };
        }
    } 
}

// TODO: https://github.com/elm-lang/elm-compiler/blob/master/src/AST/Variable.hs#L314
type CanonicalVariable = any;


interface ExportValue {
    kind: "value";
}

interface ExportAlias {
    kind: "alias"
}

interface ExportUnion {
    kind: "union";
    ctors: string;
}

interface Lambda {
    kind: "lambda";
    left: Canonical;
    right: Canonical;
}

interface Var {
    kind: "var";
    name: string;
}

interface Type {
    kind: "type";
    var: CanonicalVariable;
}

interface App {
    kind: "app";
    left: Canonical;
    right: Canonical[];
}

interface Record {
    kind: "record"
}

interface Aliased {
    kind: "aliased";
    fields: RecordField[];
    filled: boolean;
}

type Canonical = Lambda | Var | Type | App | Record | Aliased;


function typeIntToCanonical(typeInt: number) : string {
    switch (typeInt) {
        case 0: {
            return "lambda";
        }
        case 1: {
            return "var";
        }
        case 2: {
            return "type";
        }
        case 3: {
            return "app";
        }
        case 4: {
            return "record";
        }
        case 5: {
            return "aliased";
        }
    }
}

type ExportType = ExportAlias | ExportUnion | ExportValue;

interface ElmExport {
    name : string;
    exportType : ExportType;
}