var path = require('path');
var fs = require('fs');
var async = require('async');
var jsonfile = require('jsonfile');
var sourceFilesPath = path.join(__dirname, 'src');

var finishParsingLines = function(err, results) {
  //Cleaning up the parsed lines to remove lines without paragraphs
  var date;
  for(var i = 0; i < results.length; i++) {
    if(results[i].date != null) {
      date = results[i].date;
      break;
    }
  }
  var cleanedLines = [];
  for(var i = 0; i < results.length; i++) {
    if(results[i]["paragraph_number"] == null) {
      continue;
    }
    var line = results[i];
    line["date"] = date;
    cleanedLines.push(line);
  }

  //Creating indexes directory if it isn't present
  var indexDirPath = path.join(__dirname, 'indexes');
  if (!fs.existsSync(indexDirPath)){
    fs.mkdirSync(indexDirPath);
  }

  //Creating index file
  var indexPath = path.join(__dirname, 'indexes', date + '.json');
  var obj = {paragraphs: cleanedLines};
  jsonfile.writeFile(indexPath, obj, function(err) {
    console.log(err);
  });
};

//Template function to find single regex matches
var singleRegexMatch = function(text, pattern, callback) {
  var textMatch = text.match(pattern);
  if(textMatch == null) {
    callback(null, null);
  }
  else {
    callback(null, textMatch[1]);
  }
}

//Template function to find multiple regex matches
var multipleRegexMatch = function(text, pattern, callback) {
  var textMatches = [], textMatch;
  while((textMatch = pattern.exec(text)) != null) {
    textMatches.push(textMatch[1]);
  }
  if(textMatches.length == 0) {
    callback(null, null);
  }
  else {
    callback(null, textMatches);
  }
}

//Function to parse every line of the transcript
var parseLine = function(line, callback) {
  var result = {};

  //Finding the date if found in line
  var date = line.match(/\<\<(.*)\>\>/);
  result["date"] = date == null ? null : date[1];

  //Finding the paragraph number if found in line
  var paragraphNumber = line.match(/\<(.*)\>[^\>]/);
  result["paragraph_number"] = paragraphNumber == null ? null : parseInt(paragraphNumber[1]);

  //Checking if the line is a paragraph or not. To determine further markup parsing
  if(paragraphNumber != null) {

    //Defining the regexes for finding the markup :D
    var nameRegex = /[^\[]\[\[([^\[\]]*)\]\][^\]]/;
    var mentionedNameRegex = /\[\[\[([^\[\]]*)\]\]\]/g;
    var importantSpeechRegex = /\\\\(.*)\\\\/g;
    var referencedArticleRegex = /\|\|([0-9,\s]*)\|\|/g;
    var contentCategoryRegex = /\#\#(.*)\#\#/;
    var foreignConstitutionsRegex = /\#\/(.*)\#\//;

    /*
    Callback function to define behaviour on matching completion for speaker name,
    mentioned names, important speeches, referenced articles, content cateogries
    and foreign constitution references.
    */
    var onFinishRegexMatching = function(err, results) {
      if(err) {
        console.log("Error in Regex Matching!")
      }
      else {
        result["name"] = results[0];
        result["mentioned_names"] = results[1];
        result["important_speeches"] = results[2];

        //Converting list of referenced articles to an array of article numbers.
        var referencedArticles = results[3];
        if(referencedArticles == null) {
          result["referenced_articles"] = null;
        }
        else {
          var referencedArticlesNumbers = [];
          for(var i = 0; i < referencedArticles.length; i++) {
            var temp = referencedArticles[i].split(',');
            for(var j = 0; j < temp.length; j++) {
              temp[j] = parseInt(temp[j].replace( /^\D+/g, ''));
            }
            referencedArticlesNumbers = referencedArticlesNumbers.concat(temp);
          }
          result["referenced_articles"] = referencedArticlesNumbers;
        }

        // if list, split. Else null
        result["content_category"] = (results[4] ? results[4].split(/,[\s]+/) : null);

        //Converting list of foreing constitutions referred to an array of foreign constitutions
        var foreignConstitutions = results[5];
        if(foreignConstitutions == null) {
          result["foreign_consitutions"] = null;
        }
        else {
          foreignConstitutions = foreignConstitutions.split(',');
          for(var i = 0; i < foreignConstitutions.length; i++) {
            foreignConstitutions[i] = foreignConstitutions[i].trim();
          }
          result["foreign_consitutions"] = foreignConstitutions;
        }
        //Returning the result object containing all markup info for paragraph
        callback(null, result);
      }
    };

    //Performing the regex matching in parallel
    async.parallel([singleRegexMatch.bind(null, line, nameRegex),
    multipleRegexMatch.bind(null, line, mentionedNameRegex),
    multipleRegexMatch.bind(null, line, importantSpeechRegex),
    multipleRegexMatch.bind(null, line, referencedArticleRegex),
    singleRegexMatch.bind(null, line, contentCategoryRegex),
    singleRegexMatch.bind(null, line, foreignConstitutionsRegex)], onFinishRegexMatching);
  }
  else {
    callback(null, result);
  }
};

//Function to read the transcript file and split to line by line
var readSourceFile = function(err, result) {
  var lines = result.toString().split('\n');
  async.map(lines, parseLine, finishParsingLines);
};

//Function to get all the transcript files in the src/ directory
var getSourceFiles = function(err, files) {
  for(var i = 0; i < files.length; i++) {
    if(path.extname(files[i]) == '.txt') {
      fs.readFile(path.join(__dirname, 'src', files[i]), readSourceFile);
    }
  }
};

fs.readdir(sourceFilesPath, getSourceFiles);
