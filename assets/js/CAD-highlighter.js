define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var CADHighlightRules = function() {

    // regexp must not have capturing parentheses. Use (?:) instead.
    // regexps are ordered -> the first match is used
    this.$rules = {
        "start" : [
            {
                token : "constant.language.boolean",
                regex : /\[\[[^\[\]]*\]\]/
            },
            {
                token : "constant.language.boolean",
                regex : /\[\[\[[^\[\]]*\]\]\]/
            },
            {
                token : "constant.language.boolean",
                regex : /\<\<[^\<\>]*\>\>/
            },
            {
                token : "constant.language.boolean",
                regex : /\{\{[^\{\}]*\}\}/
            }
        ]
    };
    
};

oop.inherits(CADHighlightRules, TextHighlightRules);

exports.JsonHighlightRules = CADHighlightRules;

});
