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