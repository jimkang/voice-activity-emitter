voice-activity-emitter
==================

A wrapper around [voice-activity-detection](https://github.com/Jam3/voice-activity-detection/) that emits voice audio as it captures it from the mic.

[Here's a demo.](https://jimkang.com/voice-activity-emitter/)

Installation
------------

    npm install voice-activity-emitter

Usage
-----

    var VoiceActivityEmitter = require('voice-activity-emitter');
    var toWav = require('audiobuffer-to-wav');
		var emitter = VoiceActivityEmitter({});

		emitter.on('error', handleError);
		emitter.on('segment', playSegment);

		function start() {
			console.log('started');
			emitter.startListening();
		}

		function stopListening() {
			console.log('stopListening');
			emitter.stopListening();
		}

		function playSegment({ startTime, audioBuffer }) {
      var blob = new Blob([toWav(audioBuffer)]);
			var audio = new Audio(blob);
			audio.play();
		}

License
-------

The MIT License (MIT)

Copyright (c) 2019 Jim Kang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
