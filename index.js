var VAD = require('voice-activity-detection');
var dictOfArrayUtils = require('./dict-of-arrays');
var { to } = require('await-to-js');
var ContextKeeper = require('audio-context-singleton');
var curry = require('lodash.curry');
var ep = require('errorback-promise');

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
  minSegmentLengthMS = 200,
  maxCaptureSeconds = 20,
  sampleRate = 48000
}) {
  var recorder;
  var recordingBuffer;
  var recordingBufferLength = 0;
  var contextKeeper = ContextKeeper();
  var listenersForEvents = {};
  var vad;
  var cuttingASegment = false;
  var voiceIsActivated = false;

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

  async function startListening() {
    if (vad) {
      return;
    }
    var result = await ep(contextKeeper.getNewContext, { sampleRate });
    if (result.error) {
      onError(result.error);
      return;
    }

    var audioCtx = result.values[0];

    recordingBuffer = new AudioBuffer({
      length: maxCaptureSeconds * sampleRate,
      numberOfChannels: 1,
      sampleRate
    });

    var [error, stream] = await to(
      navigator.mediaDevices.getUserMedia({
        audio: true,
        noiseSuppression: true
      })
    );
    if (error) {
      onError(error);
      return;
    }

    if (!recorder) {
      //recorder = new MediaRecorder(stream);
      recorder = audioCtx.createScriptProcessor(4096, 1, 1);
      recorder.onaudioprocess = saveChunk;
      let source = audioCtx.createMediaStreamSource(stream);
      source.connect(recorder);
      // If you create a ScriptProcessorNode with no
      // destination, it will never get audioprocess events.
      recorder.connect(audioCtx.destination);
    }

    startWatchingStream(audioCtx, stream);
  }

  function stopListening() {
    if (vad) {
      vad.destroy();
      vad = null;
    }
  }

  function saveChunk(e) {
    if (voiceIsActivated) {
      let channelData = new Float32Array(e.inputBuffer.length);
      e.inputBuffer.copyFromChannel(channelData, 0, 0);
      recordingBuffer.copyToChannel(channelData, 0, recordingBufferLength);
      recordingBufferLength += channelData.length;
    }
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
    voiceIsActivated = true;
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
    voiceIsActivated = false;
    if (lastStartTime && recordingBufferLength > 0) {
      cutSegment();
    }
    lastStartTime = 0;
  }

  function cutSegment() {
    if (cuttingASegment) {
      return;
    }

    cuttingASegment = true;

    var clipBuffer = copyAudioBuffer(recordingBuffer, recordingBufferLength);

    recordingBufferLength = 0;

    if (clipBuffer.duration > minSegmentLengthMS / 1000) {
      let segmentListeners = dictOfArrayUtils.getValuesForKey(
        listenersForEvents,
        'segment'
      );
      segmentListeners.forEach(curry(sendSegment)(clipBuffer, lastStartTime));
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
function sendSegment(audioBuffer, startTime, listener) {
  listener({ audioBuffer, startTime });
}

function copyAudioBuffer(src, length) {
  var dest = new AudioBuffer({
    length,
    numberOfChannels: 1,
    sampleRate: src.sampleRate
  });

  var pcmData = src.getChannelData(0).slice(0, length);

  dest.copyToChannel(pcmData, 0, 0);
  return dest;
}

module.exports = VoiceActivityEmitter;
