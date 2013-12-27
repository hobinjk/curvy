var canvas = document.getElementById("curves");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

var gfx = canvas.getContext("2d");

var curve = [];
var mousePressed = false;
var wordCurveResolution = 10;
var lastCoords = {x: 0, y: 0};

var keyboardScale = 50;
var suggestionCount = 5;
var bestWords = new Array(suggestionCount);
for(var i = 0; i < bestWords.length; i++)
  bestWords[i] = "";

document.addEventListener("mousedown", function(event) {
  curve = [];
  mousePressed = true;
});

document.addEventListener("mouseup", function(event) {
  mousePressed = false;


  bestWords = findBestSuggestions(curve, wordList).map(function(suggestion) { return suggestion.word; });
  draw();
});

document.addEventListener("mousemove", function(event) {
  if(!mousePressed) return;

  var diff = (event.clientX - lastCoords.x)*(event.clientX - lastCoords.x)
  + (event.clientY - lastCoords.y)*(event.clientY - lastCoords.y)
  if(diff > wordCurveResolution*wordCurveResolution) {
    lastCoords = {x: event.clientX, y: event.clientY};
    curve.push(lastCoords);
  }
  draw();
});

function getWordCurve(word) {
  var wordCurve = [];
  for(var i = 0; i < word.length; i++) {
    var key = word.charAt(i);
    var coords = getKeyCoords(key);
    if(i > 0) {
      var lastCoords = wordCurve[wordCurve.length-1];
      var dx = coords.x - lastCoords.x;
      var dy = coords.y - lastCoords.y;
      var mag = Math.sqrt(dx*dx + dy*dy);
      for(var sub = wordCurveResolution; sub < mag; sub += wordCurveResolution) {
        var dCoords = {x: lastCoords.x + dx*sub/mag, y: lastCoords.y + dy*sub/mag};
        wordCurve.push(dCoords);
      }
    }

    wordCurve.push(coords);
  }

  return wordCurve;
}

function drawKeyboard() {
  gfx.textAlign = "center";
  gfx.textBaseline = "middle";

  for(var keyIdx = 'a'.charCodeAt(0); keyIdx <= 'z'.charCodeAt(0); keyIdx++) {
    var key = String.fromCharCode(keyIdx);
    var coords = getKeyCoords(key);
    gfx.strokeStyle = "white";
    gfx.fillStyle = "#444";
    gfx.fillRect(coords.x-keyboardScale/2, coords.y-keyboardScale/2, keyboardScale, keyboardScale);
    gfx.strokeRect(coords.x-keyboardScale/2, coords.y-keyboardScale/2, keyboardScale, keyboardScale);
    gfx.fillStyle = "white";
    gfx.fillText(key.toUpperCase(), coords.x, coords.y);
  }
}

function getKeyCoords(key) {
  getKeyCoords.cache || (getKeyCoords.cache = {});
  if(key in getKeyCoords.cache) return getKeyCoords.cache[key];

  var rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  for(var row = 0; row < rows.length; row++) {
    var index = rows[row].indexOf(key);
    if(index < 0) continue;

    var x = (index-rows[row].length/2)*keyboardScale + 300;
    if(row === 2) x -= keyboardScale/2;
    var y = row*keyboardScale + 200;

    return getKeyCoords.cache[key] = {x: x, y: y};
  }
  throw "not a key: "+key;
}


function strokeCurve(curve) {
  if(curve.length === 0)
    return;

  gfx.beginPath();
  gfx.moveTo(curve[0].x, curve[0].y);
  for(var i = 1; i < curve.length; i++) {
    gfx.lineTo(curve[i].x, curve[i].y);
  }
  gfx.stroke();
}

function getCurveSimilarity(baseCurve, testCurve) {
  function getDiffs(curve) {
    var diffs = new Array(curve.length-1);
    for(var i = 0; i < curve.length-1; i++) {
      var low = curve[i];
      var high = curve[i+1];
      var midX = (low.x + high.x)/2
      var midY = (low.y + high.y)/2

      var diffX = high.x - low.x;
      var diffY = high.y - low.y;

      diffs[i] = {
        x: midX,
        y: midY,
        dx: diffX,
        dy: diffY
      };
    }

    return diffs;
  }

  var baseDiffs = getDiffs(baseCurve);
  var testDiffs = getDiffs(testCurve);

  function baseCompare(baseDiffs, testDiffs) {
    if(baseDiffs.length === 0)
      return 9001*9001;
    var totalScore = 0;
    for(var i = 0; i < testDiffs.length; i++) {
      var testDiff = testDiffs[i];
      var closestDiff = i < baseDiffs.length ? baseDiffs[i] : baseDiffs[baseDiffs.length-1];
      var closestScore = (closestDiff.x - testDiff.x)*(closestDiff.x - testDiff.x)
                       + (closestDiff.y - testDiff.y)*(closestDiff.y - testDiff.y);
      /*
      var closestDiff = baseDiffs[0];
      var closestScore = 9001*9001;
      for(var j = 0; j < baseDiffs.length; j++) {
        var baseDiff = baseDiffs[j];
        var score = (baseDiff.x - testDiff.x)*(baseDiff.x - testDiff.x)
                  + (baseDiff.y - testDiff.y)*(baseDiff.y - testDiff.y);
        if(score < closestScore) {
          closestScore = score;
          closestDiff = baseDiff;
        }
      }
      */

      var testTheta = Math.atan2(testDiff.dy, testDiff.dx);
      var baseTheta = Math.atan2(closestDiff.dy, closestDiff.dx);
      var thetaDiff = baseTheta - testTheta;
      if(thetaDiff < -Math.PI) thetaDiff += 2*Math.PI;
      if(thetaDiff > Math.PI) thetaDiff -= 2*Math.PI;


      //console.log(testTheta - baseTheta);
      totalScore += Math.abs(thetaDiff)*Math.sqrt(closestScore);
    }
    // totalScore /= testDiffs.length;
    return totalScore;
  }

  var totalScore = baseCompare(testDiffs, baseDiffs) + baseCompare(baseDiffs, testDiffs);
  return totalScore;
}

function findBestSuggestions(testCurve, words) {
  var bestSuggestions = new Array(suggestionCount);
  for(var i = 0; i < suggestionCount; i++) {
    bestSuggestions[i] = {word: "", score: 9001*9001};
  }


  if(testCurve.length === 0)
    return "";

  for(var i = 0; i < words.length; i++) {
    var wordCurve = getWordCurve(words[i]);
    var wordScore = getCurveSimilarity(wordCurve, testCurve);
    if(words[i] === "red" || words[i] === "fed")
      console.log(words[i]+": "+wordScore);
    if(wordScore > bestSuggestions[bestSuggestions.length-1]) {
      continue;
    }
    for(var suggestion = 0; suggestion < suggestionCount; suggestion++) {
      if(bestSuggestions[suggestion].score < wordScore)
        continue;
      for(var copy = suggestionCount-2; copy >= suggestion; copy--) {
        bestSuggestions[copy+1].word = bestSuggestions[copy].word;
        bestSuggestions[copy+1].score = bestSuggestions[copy].score;
      }
      bestSuggestions[suggestion].word = words[i];
      bestSuggestions[suggestion].score = wordScore;
      break;
    }
  }

  console.log("best is: "+bestSuggestions[0].word+" with score "+bestSuggestions[0].score);
  return bestSuggestions;
}

function draw() {
  gfx.fillStyle = "black";
  gfx.fillRect(0,0,canvas.width,canvas.height);

  gfx.fillStyle = "white";
  gfx.textAlign = "left";
  gfx.textBaseline = "baseline";
  for(var i = 0; i < suggestionCount; i++) {
    gfx.fillText(bestWords[i], 20,20+i*20);
  }

  drawKeyboard();

  gfx.strokeStyle = "red";
  strokeCurve(curve);

  /*for(var i = 0; i < wordList.length; i++) {
    var hue = (i * 51) % 360;
    gfx.strokeStyle = "hsb("+hue+",100,100)";
    strokeCurve(getWordCurve(wordList[i]));
  }*/


  /*gfx.strokeStyle = "#00ff00";
  strokeCurve(getWordCurve("fed"));
  gfx.strokeStyle = "#00ffff";
  strokeCurve(getWordCurve("red"));*/
}

draw();
