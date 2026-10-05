(function () {
  'use strict';

  var audio = document.getElementById('sessionAudio');
  var playButton = document.getElementById('playButton');
  var progress = document.getElementById('progress');
  var currentTime = document.getElementById('currentTime');
  var duration = document.getElementById('duration');
  var status = document.getElementById('playerStatus');
  var canvas = document.getElementById('visualizerCanvas');

  if (!audio || !playButton || !progress || !canvas) return;

  var context = canvas.getContext('2d');
  var audioContext;
  var analyser;
  var source;
  var frequencyData;
  var animationFrame;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var seeking = false;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    var minutes = Math.floor(seconds / 60);
    var remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
    return minutes + ':' + remaining;
  }

  function updateProgress() {
    if (!seeking && Number.isFinite(audio.duration) && audio.duration > 0) {
      var percentage = (audio.currentTime / audio.duration) * 100;
      progress.value = percentage;
      progress.style.setProperty('--progress', percentage + '%');
    }
    currentTime.textContent = formatTime(audio.currentTime);
  }

  function setPlayingState(isPlaying) {
    playButton.classList.toggle('is-playing', isPlaying);
    playButton.setAttribute('aria-label', isPlaying ? 'Pause guided yoga session' : 'Play guided yoga session');
    status.textContent = isPlaying ? 'Your practice is playing' : (audio.ended ? 'Practice complete' : 'Practice paused');
  }

  function setupAudioAnalysis() {
    if (audioContext) {
      if (audioContext.state === 'suspended') audioContext.resume();
      return;
    }

    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.88;
      source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
    } catch (error) {
      analyser = null;
    }
  }

  function togglePlayback() {
    if (audio.paused) {
      setupAudioAnalysis();
      var playback = audio.play();
      if (playback) {
        playback.catch(function () {
          status.textContent = 'Unable to play the session. Please try again.';
        });
      }
    } else {
      audio.pause();
    }
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (reducedMotion.matches) drawVisualizer(performance.now());
  }

  function getEnergy(time) {
    if (analyser && !audio.paused) {
      analyser.getByteFrequencyData(frequencyData);
      var total = 0;
      var sampleCount = Math.min(54, frequencyData.length);
      for (var i = 0; i < sampleCount; i += 1) total += frequencyData[i];
      return total / sampleCount / 255;
    }
    return 0.06 + Math.sin(time / 1800) * 0.018;
  }

  function drawVisualizer(time) {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var energy = getEnergy(time);
    var centerX = width / 2;
    var centerY = height / 2;
    var baseRadius = Math.min(width, height) * 0.2;

    context.clearRect(0, 0, width, height);

    var backdrop = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.7);
    backdrop.addColorStop(0, 'rgba(201,181,188,' + (0.2 + energy * 0.22) + ')');
    backdrop.addColorStop(0.34, 'rgba(143,79,69,' + (0.14 + energy * 0.12) + ')');
    backdrop.addColorStop(1, 'rgba(36,27,32,0)');
    context.fillStyle = backdrop;
    context.fillRect(0, 0, width, height);

    for (var ring = 5; ring >= 0; ring -= 1) {
      var ringRadius = baseRadius + ring * Math.min(width, height) * 0.075 + energy * (ring + 1) * 15;
      context.beginPath();
      var points = 100;
      for (var point = 0; point <= points; point += 1) {
        var angle = point / points * Math.PI * 2;
        var frequency = 0;
        if (frequencyData && analyser && !audio.paused) {
          frequency = frequencyData[Math.floor(point / points * Math.min(64, frequencyData.length))] / 255;
        }
        var drift = Math.sin(angle * 3 + time / 1600 + ring) * 3;
        var pulse = frequency * (14 + ring * 2) + drift;
        var x = centerX + Math.cos(angle) * (ringRadius + pulse);
        var y = centerY + Math.sin(angle) * (ringRadius + pulse);
        if (point === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.strokeStyle = 'rgba(232,223,212,' + (0.08 + (5 - ring) * 0.025 + energy * 0.12) + ')';
      context.lineWidth = ring === 0 ? 1.5 : 1;
      context.stroke();
    }

    var glowRadius = baseRadius * (0.52 + energy * 0.38);
    var glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
    glow.addColorStop(0, 'rgba(247,242,236,' + (0.3 + energy * 0.34) + ')');
    glow.addColorStop(0.45, 'rgba(201,181,188,' + (0.16 + energy * 0.24) + ')');
    glow.addColorStop(1, 'rgba(201,181,188,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    context.fill();

    if (!reducedMotion.matches) animationFrame = window.requestAnimationFrame(drawVisualizer);
  }

  playButton.addEventListener('click', togglePlayback);

  audio.addEventListener('play', function () {
    setPlayingState(true);
    if (!animationFrame && !reducedMotion.matches) animationFrame = window.requestAnimationFrame(drawVisualizer);
  });
  audio.addEventListener('pause', function () {
    setPlayingState(false);
  });
  audio.addEventListener('ended', function () {
    setPlayingState(false);
    progress.value = 100;
    progress.style.setProperty('--progress', '100%');
  });
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('loadedmetadata', function () {
    duration.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('error', function () {
    status.textContent = 'The session audio is temporarily unavailable.';
    playButton.disabled = true;
  });

  progress.addEventListener('input', function () {
    seeking = true;
    progress.style.setProperty('--progress', progress.value + '%');
    if (Number.isFinite(audio.duration)) {
      currentTime.textContent = formatTime((progress.value / 100) * audio.duration);
    }
  });
  progress.addEventListener('change', function () {
    if (Number.isFinite(audio.duration)) audio.currentTime = (progress.value / 100) * audio.duration;
    seeking = false;
  });

  reducedMotion.addEventListener('change', function () {
    if (reducedMotion.matches) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      drawVisualizer(performance.now());
    } else if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(drawVisualizer);
    }
  });

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();
  drawVisualizer(performance.now());
})();
