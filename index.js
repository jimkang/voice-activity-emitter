var VAD = require('voice-activity-detection');
var dictOfArrayUtils = require('./dict-of-arrays');
var { to } = require('await-to-js');
var ContextKeeper = require('audio-context-singleton');
var queue = require('d3-queue').queue;
var curry = require('lodash.curry');

var sb = require('standard-bail')();

function VoiceActivityEmitter({
  fftSize = 512,
  bufferLen = 512,
  smoothingTimeConstant = 0.2,
  minCaptureFreq = 85, // in Hz
  maxCaptureFreq = 255, // in Hz
  noiseCaptureDuration = 1000, // in ms
  minNoiseLevel = 0.6, // from 0 to 1
  maxNoiseLevel = 0.9, // from 0 to 1
  avgNoiseMultiplier = 1.2,
  segmentCutTimeLimit = 1000,
  minSegmentLength = 200
}) {
  var recorder;
  var contextKeeper = ContextKeeper();
  var listenersForEvents = {};
  var vad;
  var cuttingASegment = false;
  var cutTimerId;
  var currentRecordingChunks = [];

  var lastStartTime;

  return {
    on,
    removeListener,
    startListening,
    stopListening
  };

  function on(eventName, listener) {
    dictOfArrayUtils.add(listenersForEvents, eventName, listener);
  }

  function removeListener(eventName, listener) {
    dictOfArrayUtils.remove(listenersForEvents, eventName, listener);
  }

  function startListening() {
    if (vad) {
      return;
    }
    var q = queue();
    q.defer(contextKeeper.getCurrentContext);
    q.defer(setUpRecorder);
    q.await(sb(startWatchingStream, onError));
  }

  function stopListening() {
    if (vad) {
      vad.destroy();
      vad = null;
    }
  }

  async function setUpRecorder(done) {
    var [error, stream] = await to(
      navigator.mediaDevices.getUserMedia({ audio: true })
    );
    if (error) {
      done(error);
      return;
    }

    if (recorder) {
      done(null, stream);
      return;
    }

    recorder = new MediaRecorder(stream);
    recorder.addEventListener('dataavailable', saveChunk);
    done(null, stream);
  }

  function saveChunk(e) {
    currentRecordingChunks.push(e.data);
  }

  function startWatchingStream(audioCtx, stream) {
    vad = VAD(audioCtx, stream, {
      fftSize,
      bufferLen,
      smoothingTimeConstant,
      minCaptureFreq,
      maxCaptureFreq,
      noiseCaptureDuration,
      minNoiseLevel,
      maxNoiseLevel,
      avgNoiseMultiplier,
      onVoiceStart,
      onVoiceStop
    });
  }

  function onVoiceStart() {
    lastStartTime = performance.now();
    console.log('Voice started.', lastStartTime);
    currentRecordingChunks.length = 0;
    recorder.start();
  }

  function onVoiceStop() {
    if (lastStartTime) {
      cutSegment({ startTime: lastStartTime, stopTime: performance.now() });
    }
  }

  function cutSegment({ startTime, stopTime }) {
    if (cuttingASegment) {
      return;
    }

    cuttingASegment = true;

    cutTimerId = setTimeout(abandonCut, segmentCutTimeLimit);

    recorder.addEventListener('stop', sendDataToListener);
    if (recorder.state === 'recording') {
      recorder.stop();
    }

    function sendDataToListener() {
      if (!cuttingASegment) {
        // If we timed out have and have moved on, let this one go.
        return;
      }
      recorder.removeEventListener('stop', sendDataToListener);
      var blob = new Blob(currentRecordingChunks, {
        type: 'audio/ogg; codecs=opus'
      });

      if (stopTime - startTime >= minSegmentLength) {
        let segmentListeners = dictOfArrayUtils.getValuesForKey(
          listenersForEvents,
          'segment'
        );
        segmentListeners.forEach(curry(sendSegment)(startTime, stopTime, blob));
      }

      clearTimeout(cutTimerId);
      cuttingASegment = false;
    }
  }

  function abandonCut() {
    cuttingASegment = false;
  }

  function onError(error) {
    console.error(error, error.stack);
    var errorListeners = dictOfArrayUtils.getValuesForKey(
      listenersForEvents,
      'error'
    );
    errorListeners.forEach(sendError);

    function sendError(listener) {
      listener(error);
    }
  }
}

// startTime and stopTime aren't going to
// line up with the chunks exactly. Watch to
// see if this is a significant problem.
function sendSegment(startTime, stopTime, blob, listener) {
  listener({ startTime, stopTime, blob });
}

module.exports = VoiceActivityEmitter;
