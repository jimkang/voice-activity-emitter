var VoiceActivityEmitter = require('./index');
var handleError = require('handle-error-web');
var d3 = require('d3-selection');
var accessor = require('accessor');
var segments = [];
var capturedRoot = d3.select('#captured-root');
var toWav = require('audiobuffer-to-wav');

document.getElementById('start-button').addEventListener('click', start);
document.getElementById('stop-button').addEventListener('click', stopListening);
var listeningMessage = document.getElementById('listening-message');

var emitter = VoiceActivityEmitter({});

emitter.on('error', handleError);
emitter.on('segment', addSegmentToList);
emitter.on('start', indicateListening);

function start() {
  console.log('started');
  emitter.startListening();
}

function stopListening() {
  console.log('stopListening');
  emitter.stopListening();
}

function indicateListening({ startTime }) {
  listeningMessage.textContent = 'Speaking began at ' + startTime;
  listeningMessage.classList.remove('hidden');
}

function addSegmentToList(segment) {
  listeningMessage.classList.add('hidden');
  console.log('Got segment.', segment);
  segments.push(segment);
  renderSegments(segments);
}

function renderSegments(segments) {
  var segmentItems = capturedRoot
    .selectAll('.segment')
    .data(segments, getSegmentId);
  segmentItems.exit().remove();
  var newSegments = segmentItems
    .enter()
    .append('li')
    .classed('segment', true);
  newSegments.append('div').classed('start-time', true);
  newSegments.append('audio').attr('controls', true);

  var currentSegments = newSegments.merge(segmentItems);

  currentSegments.select('.start-time').text(accessor('startTime'));

  currentSegments.select('audio').attr('src', getBlobURL);
}

function getSegmentId({ startTime, stopTime }) {
  return `segment-${startTime}-${stopTime}`;
}

function getBlobURL({ audioBuffer }) {
  var blob = new Blob([toWav(audioBuffer)]);
  return window.URL.createObjectURL(blob);
}
