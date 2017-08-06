/* 
    MODIFIED FROM: https://github.com/shamansir/node-elm-repl  
    Original implementation by shamansir
*/

const Parser = require('binary-parser').Parser;

var stop = new Parser();

// version

var versionParser = new Parser()
    .skip(4).int32('major')
    .skip(4).int32('minor')
    .skip(4).int32('patch');

// package info

var packageInfoParser = new Parser()
    .skip(4).int32('userLen')
    .string('user', { length: 'userLen' })
    .skip(4).int32('nameLen')
    .string('name', { length: 'nameLen' });

var packageInfoFormatter = function(v) {
    return {
        'user': v.user, 'name': v.name
    };
};

// imports

var importPathItemParser = new Parser()
    .skip(4).int32('itemLen')
    .string('item', { length: 'itemLen' });

var singleImportParser = new Parser()
    .skip(4).int32('count')
    .array('path', {
        type: importPathItemParser,
        length: 'count'
    });

var importsParser = new Parser()
    .skip(4).int32('count')
    .array('values', {
        type: singleImportParser,
        length: 'count'
    });

var importsFormatter = function(v) {
    return v.values.map(function(iv) {
        return {
            path: iv.path.map(function(pv) {
                      return pv.item;
                  })
        }
    });
};

// exports

var exportPathItemParser = new Parser()
    .skip(4).int32('itemLen')
    .string('item', { length: 'itemLen' });

var exportPathParser = new Parser()
    .skip(4).int32('count')
    .array('path', {
        type: exportPathItemParser,
        length: 'count'
    })
    .skip(1);

function exportPathFormatter(v) {
    if (!v.path) return v;
    return v.path.map(function(data) {
        return data.item;
    });
}

var singleExportParser = new Parser()
    .int8('type')
    .skip(4).int32('nameLen')
    .string('name', { length: 'nameLen' })
    .choice('values', {
        tag: 'type',
        choices: {
            0: stop,
            1: stop,
            2: exportPathParser
        },
        formatter: exportPathFormatter
    });

var exportsParser = new Parser()
    .skip(4).int32('count')
    .array('values', {
        type: singleExportParser,
        length: 'count'
    });

var exportsFormatter = function(v) {
    function exportToString (ev){
        if (ev.type === 0) return ev.name;
        if (ev.type === 1) return ev.name;

        return ev.name;
    }

    return v.values.map(function(ev) {
        if (ev.type === 0) {
            return { 'type': 'single',
                     'name': ev.name,
                     'asString': exportToString(ev) };
        } else if (ev.type === 1) {
            return { 'type': 'list',
                     'path': [ ev.name ],
                     'asString': exportToString(ev) };
        } else if (ev.type === 2) {
            return { 'type': 'nested',
                     'name': ev.name,
                     'values': ev.values,
                     'asString': exportToString(ev) };
        }
    });
};


// types

var nodeParser = new Parser().namely('node');

var variableParser = new Parser()
    .skip(4).int32('nameLen')
    .string('name', { length: 'nameLen' });

function variableFormatter(v) {
    return v.name;
}

var holleyTypeParser = new Parser()
    .skip(4).int32('nameLen')
    .string('name', { length: 'nameLen' });

var filledTypeParser = new Parser()
    .skip(4).int32('userLen')
    .string('user', { length: 'userLen' })
    .skip(4).int32('packageLen')
    .string('package', { length: 'packageLen' })
    .skip(4).int32('subNamesCount')
    .skip(4).int32('nameLen')
    .string('name', { length: 'nameLen' })
    .array('subNames', {
        length: 'subNamesCount',
        type: Parser.start()
            .skip(4).int32('subNameLen')
            .string('subName', { length: 'subNameLen' }),
        formatter: function(subNames) {
            return subNames.map(function(sn) { return sn.subName; });
        }
    });

var typeParser = new Parser()
    .int8('isFilled')
    .choice('inner', {
        tag: 'isFilled',
        choices: {
            0: holleyTypeParser,
            1: filledTypeParser
        }
    });

function typeFormatter(t) {
    return t.isFilled
        ? { user: t.inner.user,
            package: t.inner.package,
            path: t.inner.subNames
                ? [ t.inner.name ].concat(t.inner.subNames.splice(0, t.inner.subNames.length - 1))
                : [],
            name: t.inner.subNames ? t.inner.subNames[t.inner.subNames.length - 1] : t.inner.name }
        : { name: t.inner.name };
}

var appRightSideParser = new Parser()
   .skip(4).int32('count')
   .array('values', {
       type: 'node',
       length: 'count'/*,
       formatter: nodeArrayFormatter FIXME*/
   });

function appRightSideFormatter(rs) {
    return rs.values;
}

var recordPairParser = new Parser()
    .skip(4).int32('nameLen')
    .string('name', { length: 'nameLen' })
    .nest('node', {
        type: 'node'
    });

var recordParser = new Parser()
    .skip(4).int32('count')
    .array('fields', {
        type: recordPairParser,
        length: 'count',/*,
        formatter: nodeMapFormatter FIXME*/
    })
    .skip(1);

function recordFormatter(r) {
    return r.fields;
}

var aliasedTypeParser = new Parser()
    .nest('type', { type: typeParser,
                    formatter: typeFormatter })
    //.buffer('testMsg', { clone: true, length: 8+8+3 }) FIXME: moves offset
    .choice('fork', {
        tag: function() {
            const msgMarker = new Buffer('000000000000000100000000000000036D7367', 'hex');
            return buffer.includes(msgMarker, offset) ? 1 : 0;
        },
        defaultChoice: stop,
        choices: {
            0: Parser.start()
                     .skip(1)
                     .skip(4).int32('count')
                     .array('list', {
                         type: 'node',
                         length: 'count'/*,
                         formatter: nodeArrayFormatter FIXME*/
                     }),
            1: Parser.start()
                     .skip(8+8+3) // length of msgMarker
                     .skip(1) // variable type marker
                     .nest('msgvar', { type: variableParser,
                                       formatter: variableFormatter })
                     .skip(1)
                     .nest('msgnode', {
                         type: 'node'/*,
                         formatter: singleNodeFormatter*/
                     })
        }
    })
    ;

function aliasedTypeFormatter(at) {
    return at.fork.list
        ? {
            type: at.type,
            list: at.fork.list
        }
        : {
            type: at.type,
            msgvar: at.fork.msgvar,
            msgnode: at.fork.msgnode
        };
}

nodeParser
    .int8('tag')
    .choice('cell', {
        tag: 'tag',
        choices: {
            // Lambda a b
            0: Parser.start().nest('lambda', {
                                type: Parser.start().nest('left',  { type: 'node' })
                                                    .nest('right', { type: 'node'  })
                             }),
            // Var a
            1: Parser.start().nest('var', { type: variableParser,
                                            formatter: variableFormatter }),
            // Type a
            2: Parser.start().nest('type', { type: typeParser,
                                             formatter: typeFormatter }),
            // App a b
            3: Parser.start().nest('app', {
                                type: Parser.start().nest('subject',  { type: 'node' })
                                                    .nest('object', { type: appRightSideParser,
                                                                      formatter: appRightSideFormatter })
                             }),
            // Record a b
            4: Parser.start().nest('record', { type: recordParser,
                                               formatter: recordFormatter }),
            // Aliased a b c
            5: Parser.start().nest('aliased', {
                                type: aliasedTypeParser,
                                formatter: aliasedTypeFormatter
                             })
        }/*,
        defaultChoice: stop,*/
    });

function singleNodeFormatter(n) {
    var cell = n.cell;
    switch (n.tag) {
        case 0: return {
            type: 'lambda',
            left: singleNodeFormatter(cell.lambda.left),
            right: singleNodeFormatter(cell.lambda.right),
        };
        case 1: return {
            type: 'var',
            name: cell.var
        };
        case 2: return {
            type: 'type',
            def: cell.type
        };
        case 3: return {
            type: 'app',
            subject: singleNodeFormatter(cell.app.subject),
            object: cell.app.object.map(singleNodeFormatter)
        };
        case 4: return {
            type: 'record',
            fields: cell.record.map(function(pair) {
                return { name: pair.name, node: singleNodeFormatter(pair.node) };
            })
        };
        case 5: return {
            type: 'aliased',
            def: cell.aliased.type,
            list: cell.aliased.list ? cell.aliased.list.map(singleNodeFormatter) : [],
            msgvar: cell.aliased.msgvar || null,
            msgnode: cell.aliased.msgnode ? singleNodeFormatter(cell.aliased.msgnode) : null,
        };
    }
}

var singleNodeParser = new Parser()
    .skip(4).int32('nameLen')
    .string('name', { length: 'nameLen' })
    .nest('value', {
        type: nodeParser,
        formatter: singleNodeFormatter
    });

var typesParser = new Parser()
    .skip(4).int32('count')
    .array('values', {
        type: singleNodeParser,
        length: 'count'
    });


function typesFormatter(v) {
    function typeToString (t) {
        if (t.type === 'var') { return t.name; }
        if ((t.type === 'type') ||
            (t.type === 'aliased')) {

            let name = null;
            if (t.def.path) {
                name = t.def.path.join(".") + "." + t.def.name;
            } else {
                name = t.def.name;
            }

            return t.msgvar ? (name + ' ' + t.msgvar) : name;
        }
        if (t.type === 'lambda') {
            return ((t.left.type !== 'lambda') ? typeToString(t.left) : '(' + typeToString(t.left) + ')')
                + ' -> ' + typeToString(t.right);
        }
        if (t.type === 'app') {
            if ((t.subject.type === 'type') && (t.subject.def.name.indexOf('_Tuple') === 0)) {
                return '( ' + t.object.map(typeToString).join(', ') + ' )';
            } else if ((t.subject.type === 'type') && (t.subject.def.name === 'List')) {
                return 'List ' + t.object.map(function(t) {
                    return (t.type === 'aliased') ? '(' + typeToString(t) + ')' : typeToString(t);
                }).join(' ');
            } else {
                return typeToString(t.subject)
                    + ' ' + t.object.map(typeToString).join(' ');
            }
        }
        if (t.type === 'record') {
            return '{ ' + t.fields.map(function(pair) {
                return pair.name + ' : ' + typeToString(pair.node);
            }).join(', ') + ' }';
        }
    }


    return v.values.map(function(nv) {
        return {
            name: nv.name,
            value: nv.value,
            asString: typeToString(nv.value)
        }
    });
}


// main

var elmiParser = new Parser()
        .nest('version', { type: versionParser })
        .nest('package', { type: packageInfoParser,
                           formatter: packageInfoFormatter })
        .nest('exports', { type: exportsParser,
                           formatter: exportsFormatter })
        .nest('imports', { type: importsParser,
                           formatter: importsFormatter })
        .nest('types',   { type: typesParser,
                           formatter: typesFormatter });

module.exports = elmiParser; 