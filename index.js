var VAD = require('voice-activity-detection');
var dictOfArrayUtils = require('./dict-of-arrays');
var { to } = require('await-to-js');
var ContextKeeper = require('audio-context-singleton');
var queue = require('d3-queue').queue;
var curry = require('lodash.curry');
var pluck = require('lodash.pluck');

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
  minSegmentLength = 200,
  segmentGranularityMS = 100
}) {
  var recorder;
  var contextKeeper = ContextKeeper();
  var listenersForEvents = {};
  var vad;
  var cuttingASegment = false;
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
    // TODO: Find out if e.timecode can work here instead of manually recording time here.
    currentRecordingChunks.push({ stamp: performance.now(), data: e.data });
  }

  function getChunksInRange({ startTime, stopTime }) {
    if (currentRecordingChunks.length < 1) {
      return [];
    }

    // We can filter out other chunks, but we always have to
    // retain the first chunks, which contains header metadata.
    return pluck(
      [currentRecordingChunks[0]].concat(
        currentRecordingChunks
          .slice(1)
          .filter(
            curry(chunkIntersectsBounds)(
              segmentGranularityMS,
              startTime,
              stopTime
            )
          )
      ),
      'data'
    );
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
    recorder.start(segmentGranularityMS);
  }

  function onVoiceStart() {
    lastStartTime = performance.now();
    let startListeners = dictOfArrayUtils.getValuesForKey(
      listenersForEvents,
      'start'
    );
    startListeners.forEach(sendStart);
  }

  function sendStart(listener) {
    listener({ startTime: lastStartTime });
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

    var blob = new Blob(getChunksInRange({ startTime, stopTime }), {
      type: 'audio/ogg; codecs=opus'
    });
    // Keep that first header chunk!
    currentRecordingChunks.length = 1;

    if (stopTime - startTime >= minSegmentLength) {
      let segmentListeners = dictOfArrayUtils.getValuesForKey(
        listenersForEvents,
        'segment'
      );
      segmentListeners.forEach(curry(sendSegment)(startTime, stopTime, blob));
    }

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

function chunkIntersectsBounds(chunkLength, startTime, stopTime, chunk) {
  var chunkEnd = chunk.stamp + chunkLength;
  return (
    (chunk.stamp >= startTime && chunk.stamp <= stopTime) ||
    (chunkEnd >= startTime && chunkEnd <= stopTime) ||
    (chunk.stamp <= startTime && chunkEnd >= stopTime)
  );
}

module.exports = VoiceActivityEmitter;
