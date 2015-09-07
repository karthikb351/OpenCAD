var assert = require('assert');
var data_driven = require('data-driven')
var fs = require('fs');
var path = require('path');
var jsonfile = require('jsonfile');
var sourceFilesPath = path.join(__dirname, 'src');

var openingBrackets = ['<<', '<', '[[', '[[[', '{{'];
var closingBrackets = ['>>', '>', ']]', ']]]', '}}'];
var commonBrackets = ['\\\\', '||', '##', '#/'];

var results = [];
var inputFilesAsLines = [];

//Function to check what the nearest occuring bracket is from the index lastIndex in the line variable
var checkNearestBracket = function(line, lastIndex) {
  var openingBracketFlag, commonBracketFlag = false;
  var minimumBracketIndex = null;
  var minimumIndex = line.length;

  for(var i = 0; i < openingBrackets.length; i++) {
    var openingBracketIndex = line.indexOf(openingBrackets[i], lastIndex);
    var closingBracketIndex = line.indexOf(closingBrackets[i], lastIndex);
    if(openingBracketIndex < minimumIndex && openingBracketIndex != -1){
      openingBracketFlag = true;
      minimumBracketIndex = i;
      minimumIndex = openingBracketIndex;
    }
    if(closingBracketIndex < minimumIndex && closingBracketIndex != -1){
      openingBracketFlag = false;
      minimumBracketIndex = i;
      minimumIndex = closingBracketIndex;
    }
  }

  for(var i = 0; i < commonBrackets.length; i++) {
    var commonBracketIndex = line.indexOf(commonBrackets[i], lastIndex);
    if(commonBracketIndex < minimumIndex && commonBracketIndex != -1) {
      commonBracketFlag = true;
      minimumBracketIndex = i;
      minimumIndex = commonBracketIndex;
    }
  }
  if(minimumBracketIndex == null) {
    return null;
  }
  else if(!commonBracketFlag && minimumBracketIndex == 2 && (line.indexOf('[[') == line.indexOf('[[[') || line.indexOf('[[') == line.indexOf('[[['))) {
    //Accounting for [[ and [[[ or ]] and ]]] returing the same indexOf
    return {
      bracket: commonBracketFlag ? commonBrackets[minimumBracketIndex] : (openingBracketFlag ? openingBrackets[3] : closingBrackets[3]),
      index: minimumIndex,
      length: commonBracketFlag ? commonBrackets[minimumBracketIndex].length : (openingBracketFlag ? openingBrackets[3].length : closingBrackets[3].length),
      common_bracket_flag: commonBracketFlag,
      opening_bracket_flag: openingBracketFlag
    }
  }
  else {
    return {
      bracket: commonBracketFlag ? commonBrackets[minimumBracketIndex] : (openingBracketFlag ? openingBrackets[minimumBracketIndex] : closingBrackets[minimumBracketIndex]),
      index: minimumIndex,
      length: commonBracketFlag ? commonBrackets[minimumBracketIndex].length : (openingBracketFlag ? openingBrackets[minimumBracketIndex].length : closingBrackets[minimumBracketIndex].length),
      common_bracket_flag: commonBracketFlag,
      opening_bracket_flag: openingBracketFlag
    }
  }
};

//Checks for unmatched brackets
var checkTranscriptLines = function(lines) {
  var linesLength = lines.length;
  var lastIndex = 0;
  var stack = [];
  var errorFlag = false;
  var result = {};
  for(var i = 0; i < linesLength; i++) {
    var line = lines[i];
    var lastIndex = 0;
    while(true) {
      var check = checkNearestBracket(line, lastIndex);
      if(check == null) {
        break;
      }
      if(check['common_bracket_flag']) {
        if(stack[stack.length - 1] == check['bracket']) {
          stack.pop();
        }
        else if(commonBrackets.indexOf(stack[stack.length - 1]) != -1){
          errorFlag = true;
          result = {code: 1, message: 'Unmatched ' + stack[stack.length - 1] + ' somewhere near line ' + i};
          return result;
        }
        else {
          stack.push(check['bracket']);
        }
      }
      else if(check['opening_bracket_flag']) {
        if(check['bracket'] == '{{' && openingBrackets.indexOf(stack[stack.length - 1]) != -1) {
          errorFlag = true;
          result = {code: 1, message: 'Unmatched ' + stack[stack.length - 1] + ' somewhere near line ' + i};
          return result;
        }
        else {
          stack.push(check['bracket']);
        }
      }
      else {
        if(openingBrackets.indexOf(stack[stack.length-1]) == closingBrackets.indexOf(check['bracket'])) {
          stack.pop();
        }
        else {
          errorFlag = true;
          result = {code: 1, message: 'Unmatched ' + check['bracket'] + ' somewhere near line ' + i};
          return result;
        }
      }
      lastIndex = check.index + check.length;
    }
  }
  if(!errorFlag && stack.length == 0) {
    result = {code: 0, message: 'Transcript file is good!'};
  }
  else {
    result = {code: 1, message: 'Unknown error!'};
  }
  return result;
};

var getSourceFiles = function(files) {
  for(var i = 0; i < files.length; i++) {
    if(path.extname(files[i]) == '.txt') {
      var filePath = path.join(__dirname, 'src', files[i]);
      var fileContent = fs.readFileSync(filePath);
      var lines = fileContent.toString().split('\n');
      inputFilesAsLines.push({"input": lines, "filePath": filePath});
    }
  }
}

files = fs.readdirSync(sourceFilesPath);
getSourceFiles(files);

describe('verifySourceFiles', function() {
    data_driven(inputFilesAsLines, function() {
        it('should have an error code of 0', function(ctx) {
          var result = checkTranscriptLines(ctx.input);
          result.filePath = ctx.filePath;
          results.push(result);
          assert.equal(0, result.code, result.message);
        });
    });
});


process.on('exit', function() {
  console.log(results);
});
