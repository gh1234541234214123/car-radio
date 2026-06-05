document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('audio-player');
    const nowPlaying = document.getElementById('now-playing');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const volumeKnob = document.getElementById('volume-knob');
    const cdInput = document.getElementById('cd-input');
    const cdDisc = document.getElementById('cd-disc');
    const freqDisplay = document.getElementById('freq-display');
    const bandDisplay = document.getElementById('band-display');
    const signalBars = document.getElementById('signal-bars');
    const trackTime = document.getElementById('track-time');
    const sourceIndicator = document.getElementById('source-indicator');

    let stations = [];
    let currentIndex = 0;
    let isCDMode = false;
    let scanInterval = null;
    let presetTimer = null;

    // Load saved presets from localStorage
    const savedPresets = JSON.parse(localStorage.getItem('radioPresets') || '{}');

    // Set initial volume
    audioPlayer.volume = 0.5;

    // Fetch stations with CORS proxy
    const proxy = 'https://corsproxy.io/?';
    const apiUrl = 'https://de1.api.radio-browser.info/json/stations?limit=10';

    fetch(proxy + encodeURIComponent(apiUrl))
        .then(response => response.json())
        .then(data => {
            stations = data;
            loadStation(0);
        })
        .catch(() => {
            nowPlaying.textContent = 'NO SIGNAL';
        });

    // ============ FREQ SCAN ANIMATION ============
    function startScan(direction, callback) {
        let freq = parseFloat(freqDisplay.textContent) || 87.5;
        const step = direction > 0 ? 0.1 : -0.1;
        const target = direction > 0 ? 108.0 : 87.5;

        bandDisplay.textContent = 'SCAN';
        signalBars.className = 'signal-bars none';

        if (scanInterval) clearInterval(scanInterval);
        scanInterval = setInterval(() => {
            freq += step;
            if (freq > target || freq < target) {
                clearInterval(scanInterval);
                scanInterval = null;
                bandDisplay.textContent = 'FM';
                callback();
                return;
            }
            freqDisplay.textContent = freq.toFixed(1);
        }, 50);
    }

    function showSignalStrength() {
        const strength = Math.floor(Math.random() * 4);
        const levels = ['none', 'weak', 'fair', 'good'];
        signalBars.className = 'signal-bars ' + levels[strength];
    }

    // ============ STATION LOADING ============
    function loadStation(index) {
        if (isCDMode) return;
        if (!stations.length) return;

        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }

        currentIndex = index;
        const station = stations[index];
        audioPlayer.src = station.url;
        audioPlayer.play();
        nowPlaying.textContent = station.name;
        playPauseBtn.textContent = '⏸';

        // Update display
        sourceIndicator.textContent = 'TUNER';
        bandDisplay.textContent = 'FM';
        const freq = (87.5 + (index * 2.05) % 20).toFixed(1);
        freqDisplay.textContent = freq;
        showSignalStrength();
        updatePresetDisplay();
    }

    // ============ CONTROLS ============
    playPauseBtn.addEventListener('click', () => {
        if (audioPlayer.paused && audioPlayer.src) {
            audioPlayer.play();
            playPauseBtn.textContent = '⏸';
            if (isCDMode) {
                cdDisc.classList.add('spinning');
            }
        } else {
            audioPlayer.pause();
            playPauseBtn.textContent = '▶';
            cdDisc.classList.remove('spinning');
        }
    });

    nextBtn.addEventListener('click', () => {
        if (isCDMode) return;
        const next = (currentIndex + 1) % stations.length;
        startScan(1, () => loadStation(next));
    });

    prevBtn.addEventListener('click', () => {
        if (isCDMode) return;
        const prev = (currentIndex - 1 + stations.length) % stations.length;
        startScan(-1, () => loadStation(prev));
    });

    // ============ PRESETS (long-press to save) ============
    function updatePresetDisplay() {
        document.querySelectorAll('.preset').forEach(btn => {
            const idx = btn.getAttribute('data-index');
            const saved = savedPresets[idx];
            btn.innerHTML = saved
                ? `${parseInt(idx) + 1}<span>${saved.name}</span>`
                : `${parseInt(idx) + 1}`;
            btn.classList.toggle('saved', !!saved);
        });
    }

    document.querySelectorAll('.preset').forEach(btn => {
        const idx = parseInt(btn.getAttribute('data-index'));

        // Short tap: load preset or station
        btn.addEventListener('click', () => {
            if (presetTimer) {
                clearTimeout(presetTimer);
                presetTimer = null;
                return;
            }
            if (savedPresets[idx]) {
                // Load saved preset station
                if (isCDMode) return;
                const saved = savedPresets[idx];
                const found = stations.findIndex(s => s.name === saved.name);
                if (found !== -1) {
                    loadStation(found);
                }
            } else if (stations[idx]) {
                // Load by index if no saved station
                loadStation(idx);
            }
        });

        // Long press: save current station to this preset
        let pressTimer = null;
        btn.addEventListener('mousedown', () => {
            pressTimer = setTimeout(() => {
                if (isCDMode) return;
                if (!stations[currentIndex]) return;
                savedPresets[idx] = {
                    name: stations[currentIndex].name,
                    index: currentIndex
                };
                localStorage.setItem('radioPresets', JSON.stringify(savedPresets));
                updatePresetDisplay();
                nowPlaying.textContent = `SAVED: ${stations[currentIndex].name}`;
                setTimeout(() => {
                    if (!isCDMode) nowPlaying.textContent = stations[currentIndex].name;
                }, 800);
                pressTimer = null;
            }, 600);
        });

        btn.addEventListener('mouseup', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });

        btn.addEventListener('mouseleave', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });
    });

    updatePresetDisplay();

    // ============ VOLUME KNOB ============
    let isDragging = false;
    let currentAngle = 135;

    function updateVolumeFromAngle(deg) {
        let vol = Math.min(Math.max((deg / 270), 0), 1);
        audioPlayer.volume = vol;
        volumeKnob.style.transform = `rotate(${deg - 135}deg)`;
    }

    volumeKnob.addEventListener('mousedown', () => isDragging = true);
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = volumeKnob.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rad = Math.atan2(e.clientY - cy, e.clientX - cx);
        let deg = rad * (180 / Math.PI) + 90;
        if (deg < 0) deg += 360;
        if (deg > 315 || deg < 45) {
            currentAngle = (deg > 315) ? 0 : 270;
        } else {
            currentAngle = deg - 45;
        }
        updateVolumeFromAngle(currentAngle);
    });
    document.addEventListener('mouseup', () => isDragging = false);

    // ============ TRACK TIME ============
    audioPlayer.addEventListener('timeupdate', () => {
        if (audioPlayer.duration) {
            const min = Math.floor(audioPlayer.currentTime / 60);
            const sec = Math.floor(audioPlayer.currentTime % 60);
            trackTime.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
        }
    });

    audioPlayer.addEventListener('ended', () => {
        playPauseBtn.textContent = '▶';
        cdDisc.classList.remove('spinning');
        if (isCDMode) {
            nowPlaying.textContent = 'CD FINISHED';
            trackTime.textContent = '0:00';
        }
    });

    // ============ CD PLAYER ============
    cdInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            isCDMode = true;
            audioPlayer.src = URL.createObjectURL(file);
            audioPlayer.play();
            cdDisc.classList.remove('empty');
            cdDisc.classList.add('spinning');
            nowPlaying.textContent = `CD: ${file.name}`;
            playPauseBtn.textContent = '⏸';
            sourceIndicator.textContent = 'CD';
            bandDisplay.textContent = '';
            freqDisplay.textContent = '--.-';
            signalBars.className = 'signal-bars none';
            trackTime.textContent = '0:00';
        }
    });

    // Eject CD
    document.querySelector('.cd-btn').addEventListener('click', (e) => {
        if (cdInput.files.length > 0 || isCDMode) {
            // Eject
            audioPlayer.pause();
            audioPlayer.src = '';
            cdInput.value = '';
            isCDMode = false;
            cdDisc.classList.add('empty');
            cdDisc.classList.remove('spinning');
            nowPlaying.textContent = 'NO DISC';
            playPauseBtn.textContent = '▶';
            sourceIndicator.textContent = 'TUNER';
            bandDisplay.textContent = 'FM';
            freqDisplay.textContent = '87.5';
            trackTime.textContent = '0:00';
            // Resume tuner
            if (stations[currentIndex]) {
                loadStation(currentIndex);
            }
        }
    });

    // ============ KEYBOARD SHORTCUTS ============
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            playPauseBtn.click();
        }
        if (e.key === 'ArrowRight') nextBtn.click();
        if (e.key === 'ArrowLeft') prevBtn.click();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = e.key === 'ArrowUp' ? 0.1 : -0.1;
            const vol = Math.min(Math.max(audioPlayer.volume + delta, 0), 1);
            audioPlayer.volume = vol;
            currentAngle = vol * 270;
            updateVolumeFromAngle(currentAngle);
        }
    });
});
