# node-elm-interface-to-json

A Javascript version of elm-interface-to-json.

## Install

```
npm install --save node-elm-interface-to-json
```

The library is intended to be used in order to gain information about a compiled Elm project. 
This information is particularly useful in order to generate valid Elm code.

Unlike @stoeffel's [elm-interface-to-json](https://github.com/stoeffel/elm-interface-to-json/), this project is written only in JS, meaning that library interop is a little easier to work with.

The parser is based on @shamansir's [node-elm-repl](https://github.com/shamansir/node-elm-repl) project. 


## Usage

```
import getExportedInterfaces from "node-elm-interface-to-json";
getExportedInterfaces("./example", "0.18.0")
.then(modules => {
    modules.map((module) => {
        console.log(module.moduleName);
        console.log(module.exports);
    });
});

```