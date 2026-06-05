document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('audio-player');
    const nowPlaying = document.getElementById('now-playing');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const volumeKnob = document.getElementById('volume-knob');
    const cdInput = document.getElementById('cd-input');
    const cdDisc = document.getElementById('cd-disc');
    const cdSlotDisc = document.getElementById('cd-slot-disc');
    const cdSlotLed = document.getElementById('cd-slot-led');
    const freqDisplay = document.getElementById('freq-display');
    const bandDisplay = document.getElementById('band-display');
    const signalBars = document.getElementById('signal-bars');
    const trackTime = document.getElementById('track-time');
    const sourceIndicator = document.getElementById('source-indicator');
    const userBtn = document.getElementById('user-btn');
    const authOverlay = document.getElementById('auth-overlay');
    const authClose = document.getElementById('auth-close');
    const googleSigninBtn = document.getElementById('google-signin-btn');
    const signoutBtn = document.getElementById('signout-btn');
    const authContent = document.getElementById('auth-content');
    const userContent = document.getElementById('user-content');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');
    const syncStatus = document.getElementById('sync-status');

    let stations = [];
    let currentIndex = 0;
    let isCDMode = false;
    let scanInterval = null;
    let presetTimer = null;
    let user = null;

    // Load saved presets from localStorage
    let savedPresets = JSON.parse(localStorage.getItem('radioPresets') || '{}');

    // ============ FIREBASE INIT ============
    const firebaseConfig = {
        apiKey: "AIzaSyCP638A6OrGeTEf9fcbmjgtxidpqRpRKOk",
        authDomain: "escer-b1d45.firebaseapp.com",
        projectId: "escer-b1d45",
        storageBucket: "escer-b1d45.firebasestorage.app",
        messagingSenderId: "210308988596",
        appId: "1:210308988596:web:a698b5c1ea425e549421e1",
        measurementId: "G-JR5J8Q621E"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // ============ AUTH STATE ============
    auth.onAuthStateChanged(async (firebaseUser) => {
        user = firebaseUser;
        if (user) {
            userBtn.classList.add('signed-in');
            userBtn.textContent = '●';
            userBtn.title = user.displayName || user.email;
            await syncPresetsFromCloud();
            updatePresetDisplay();
        } else {
            userBtn.classList.remove('signed-in');
            userBtn.textContent = '👤';
            userBtn.title = 'Sign in';
        }
        updateAuthModal();
    });

    function updateAuthModal() {
        if (user) {
            authContent.style.display = 'none';
            userContent.style.display = 'block';
            userEmail.textContent = user.email;
            userAvatar.src = user.photoURL || '';
            syncStatus.textContent = '✓ Cloud sync active';
            syncStatus.style.color = '#4f4';
        } else {
            authContent.style.display = 'block';
            userContent.style.display = 'none';
        }
    }

    // ============ FIRESTORE SYNC ============
    async function syncPresetsFromCloud() {
        if (!user) return;
        try {
            const docRef = db.collection('users').doc(user.uid);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const cloudPresets = docSnap.data().presets || {};
                // Merge: local presets take priority (most recently saved)
                savedPresets = { ...cloudPresets, ...savedPresets };
                localStorage.setItem('radioPresets', JSON.stringify(savedPresets));
            }
        } catch (err) {
            console.error('Firestore read error:', err);
        }
    }

    async function savePresetsToCloud() {
        if (!user) return;
        try {
            const docRef = db.collection('users').doc(user.uid);
            await docRef.set({ presets: savedPresets }, { merge: true });
        } catch (err) {
            console.error('Firestore write error:', err);
        }
    }

    // ============ AUTH UI ============
    userBtn.addEventListener('click', () => authOverlay.classList.add('open'));
    authClose.addEventListener('click', () => authOverlay.classList.remove('open'));
    authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) authOverlay.classList.remove('open');
    });

    googleSigninBtn.addEventListener('click', async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
            authOverlay.classList.remove('open');
        } catch (err) {
            console.error('Sign-in error:', err);
        }
    });

    signoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        savedPresets = JSON.parse(localStorage.getItem('radioPresets') || '{}');
        updatePresetDisplay();
        authOverlay.classList.remove('open');
    });

    // ============ SEARCH ============
    const searchOverlay = document.getElementById('search-overlay');
    const searchClose = document.getElementById('search-close');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchBtn = document.getElementById('search-btn');

    let searchTimeout = null;

    const popularStations = [
        { name: 'Los 40 Principales España', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40_SC' },
        { name: 'Cadena SER', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER_SC' },
        { name: 'COPE Madrid', url: 'https://cope.stream.flumotion.com/cope/copelow.mp4' },
        { name: 'Onda Cero Madrid', url: 'https://livefast.ondacero.stream/ondacero/ondefm/main/playlist.m3u8' },
        { name: 'RNE Radio 1', url: 'https://radio1.rtveradio.cires21.com/radio1/radio1/master_00.m3u8' },
        { name: 'RNE Radio 3', url: 'https://radio3.rtveradio.cires21.com/radio3/radio3/master_00.m3u8' },
        { name: 'Cadena 100', url: 'https://cadena100.stream.flumotion.com/cadena100/cadena100-low.mp4' },
        { name: 'Rock FM', url: 'https://rockfm-cope.flumotion.com/rockfm/rockfm-low.mp4' },
        { name: 'Kiss FM', url: 'https://kissfm.kissfmradio.cires21.com/kissfm/kissfm/master_00.m3u8' },
        { name: 'Flaix FM', url: 'https://flaixbarcelona.streaming-pro.com:8051/flaixbarcelona.mp3' },
        { name: 'Radio Marca', url: 'https://radiomarca.stream.flumotion.com/radiomarca/radiomarca-low.mp4' },
        { name: 'Los 40 Classic', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40_CLASSIC_SC' },
        { name: 'Cadena Dial', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENADIAL_SC' },
        { name: 'Europa FM', url: 'https://europafm.player.latv.com/stream' },
        { name: 'Maxima FM', url: 'https://maximafm.player.latv.com/stream' }
    ];

    searchBtn.addEventListener('click', () => {
        searchOverlay.classList.add('open');
        searchInput.value = '';
        searchResults.innerHTML = '<div class="search-hint">Type a station name to search</div>';
        setTimeout(() => searchInput.focus(), 100);
    });

    searchClose.addEventListener('click', () => searchOverlay.classList.remove('open'));
    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) searchOverlay.classList.remove('open');
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        if (searchTimeout) clearTimeout(searchTimeout);
        if (query.length < 2) {
            searchResults.innerHTML = '<div class="search-hint">Type at least 2 characters</div>';
            return;
        }
        searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
        searchTimeout = setTimeout(() => performSearch(query), 400);
    });

    async function performSearch(query) {
        try {
            // Radio Browser API — search by name
            const response = await fetch(proxy + encodeURIComponent(
                `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=30`
            ), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            // Also search radio.es stations locally
            const localResults = popularStations.filter(s =>
                s.name.toLowerCase().includes(query.toLowerCase())
            );

            const allResults = [...data, ...localResults.map(s => ({
                name: s.name,
                url: s.url,
                country: 'Spain',
                codec: '',
                bitrate: ''
            }))];

            // Deduplicate by URL
            const seen = new Set();
            const unique = allResults.filter(s => {
                const key = s.url;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            if (!unique.length) {
                searchResults.innerHTML = '<div class="search-hint">No stations found</div>';
                return;
            }

            searchResults.innerHTML = '';
            unique.forEach(station => {
                const item = document.createElement('div');
                item.className = 'search-result-item';

                const name = document.createElement('div');
                name.className = 'search-result-name';
                name.textContent = station.name;
                name.addEventListener('click', () => {
                    const exists = stations.findIndex(s => s.url === station.url);
                    let idx;
                    if (exists !== -1) {
                        idx = exists;
                    } else {
                        idx = stations.length;
                        stations.push(station);
                    }
                    currentIndex = idx;
                    loadStation(idx);
                    searchOverlay.classList.remove('open');
                });
                item.appendChild(name);

                const meta = document.createElement('div');
                meta.className = 'search-result-meta';
                meta.textContent = `${station.country || 'Unknown'} · ${station.codec || ''} ${station.bitrate || ''}`;
                item.appendChild(meta);

                // Preset bind buttons
                const presetRow = document.createElement('div');
                presetRow.className = 'search-preset-row';
                presetRow.innerHTML = '<span class="bind-label">BIND:</span>';
                for (let p = 0; p < 6; p++) {
                    const btn = document.createElement('button');
                    btn.className = 'preset-bind-btn';
                    const saved = savedPresets[p];
                    btn.textContent = saved ? `${p + 1}✓` : `${p + 1}`;
                    btn.title = saved ? `Replace: ${saved.name}` : `Bind to preset ${p + 1}`;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        savedPresets[p] = {
                            name: station.name,
                            index: stations.length
                        };
                        localStorage.setItem('radioPresets', JSON.stringify(savedPresets));
                        savePresetsToCloud();
                        updatePresetDisplay();
                        // Add to stations if not present
                        const exists = stations.findIndex(s => s.url === station.url);
                        if (exists === -1) stations.push(station);
                        // Flash feedback
                        const orig = btn.textContent;
                        btn.textContent = `${p + 1}✓`;
                        btn.style.borderColor = '#4f4';
                        setTimeout(() => {
                            btn.style.borderColor = '';
                            btn.textContent = savedPresets[p] ? `${p + 1}✓` : `${p + 1}`;
                            btn.title = savedPresets[p] ? `Replace: ${savedPresets[p].name}` : `Bind to preset ${p + 1}`;
                        }, 800);
                    });
                    presetRow.appendChild(btn);
                }
                item.appendChild(presetRow);

                searchResults.appendChild(item);
            });
        } catch (err) {
            // Fallback: search only local radio.es stations
            const localResults = popularStations.filter(s =>
                s.name.toLowerCase().includes(query.toLowerCase())
            );
            if (localResults.length) {
                searchResults.innerHTML = '';
                localResults.forEach(station => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    const name = document.createElement('div');
                    name.className = 'search-result-name';
                    name.textContent = station.name;
                    name.addEventListener('click', () => {
                        const exists = stations.findIndex(s => s.url === station.url);
                        let idx;
                        if (exists !== -1) {
                            idx = exists;
                        } else {
                            idx = stations.length;
                            stations.push(station);
                        }
                        currentIndex = idx;
                        loadStation(idx);
                        searchOverlay.classList.remove('open');
                    });
                    item.appendChild(name);
                    const meta = document.createElement('div');
                    meta.className = 'search-result-meta';
                    meta.textContent = 'Spain · radio.es';
                    item.appendChild(meta);
                    // Preset bind buttons
                    const presetRow = document.createElement('div');
                    presetRow.className = 'search-preset-row';
                    presetRow.innerHTML = '<span class="bind-label">BIND:</span>';
                    for (let p = 0; p < 6; p++) {
                        const btn = document.createElement('button');
                        btn.className = 'preset-bind-btn';
                        const saved = savedPresets[p];
                        btn.textContent = saved ? `${p + 1}✓` : `${p + 1}`;
                        btn.title = saved ? `Replace: ${saved.name}` : `Bind to preset ${p + 1}`;
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            savedPresets[p] = { name: station.name, index: stations.length };
                            localStorage.setItem('radioPresets', JSON.stringify(savedPresets));
                            savePresetsToCloud();
                            updatePresetDisplay();
                            const exists = stations.findIndex(s => s.url === station.url);
                            if (exists === -1) stations.push(station);
                            btn.textContent = `${p + 1}✓`;
                            btn.style.borderColor = '#4f4';
                            setTimeout(() => {
                                btn.style.borderColor = '';
                                btn.textContent = savedPresets[p] ? `${p + 1}✓` : `${p + 1}`;
                                btn.title = savedPresets[p] ? `Replace: ${savedPresets[p].name}` : `Bind to preset ${p + 1}`;
                            }, 800);
                        });
                        presetRow.appendChild(btn);
                    }
                    item.appendChild(presetRow);
                    searchResults.appendChild(item);
                });
            } else {
                searchResults.innerHTML = '<div class="search-error">Search failed. Try again.</div>';
            }
        }
    }
    const proxy = 'https://corsproxy.io/?';
    const apiUrl = 'https://de1.api.radio-browser.info/json/stations?limit=10';
    fetch(proxy + encodeURIComponent(apiUrl), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            // Merge popular radio.es stations with API results
            stations = [...data, ...popularStations];
            // Deduplicate by URL
            const seen = new Set();
            stations = stations.filter(s => {
                const key = s.url;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            loadStation(0);
        })
        .catch(() => {
            // Fallback: use only popular stations
            stations = [...popularStations];
            loadStation(0);
        });

    // ============ FREQ SCAN ============
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
                cdSlotLed.className = 'cd-slot-led active';
            }
        } else {
            audioPlayer.pause();
            playPauseBtn.textContent = '▶';
            cdDisc.classList.remove('spinning');
            if (isCDMode) cdSlotLed.className = 'cd-slot-led loading';
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

    // ============ PRESETS ============
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

        btn.addEventListener('click', () => {
            if (presetTimer) {
                clearTimeout(presetTimer);
                presetTimer = null;
                return;
            }
            if (savedPresets[idx]) {
                if (isCDMode) return;
                const saved = savedPresets[idx];
                const found = stations.findIndex(s => s.name === saved.name);
                if (found !== -1) loadStation(found);
            } else if (stations[idx]) {
                loadStation(idx);
            }
        });

        let pressTimer = null;
        btn.addEventListener('mousedown', () => {
            pressTimer = setTimeout(async () => {
                if (isCDMode) return;
                if (!stations[currentIndex]) return;
                savedPresets[idx] = {
                    name: stations[currentIndex].name,
                    index: currentIndex
                };
                localStorage.setItem('radioPresets', JSON.stringify(savedPresets));
                await savePresetsToCloud();
                updatePresetDisplay();
                nowPlaying.textContent = `SAVED: ${stations[currentIndex].name}`;
                setTimeout(() => {
                    if (!isCDMode) nowPlaying.textContent = stations[currentIndex].name;
                }, 800);
                pressTimer = null;
            }, 600);
        });

        btn.addEventListener('mouseup', () => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        });
        btn.addEventListener('mouseleave', () => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
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

    // ============ CD ============
    cdInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            isCDMode = true;
            audioPlayer.src = URL.createObjectURL(file);
            audioPlayer.play();
            cdDisc.classList.remove('empty');
            cdDisc.classList.add('spinning');
            cdSlotDisc.classList.add('loaded');
            cdSlotLed.className = 'cd-slot-led active';
            nowPlaying.textContent = `CD: ${file.name}`;
            playPauseBtn.textContent = '⏸';
            sourceIndicator.textContent = 'CD';
            bandDisplay.textContent = '';
            freqDisplay.textContent = '--.-';
            signalBars.className = 'signal-bars none';
            trackTime.textContent = '0:00';
        }
    });

    document.querySelector('.cd-btn').addEventListener('click', (e) => {
        if (cdInput.files.length > 0 || isCDMode) {
            audioPlayer.pause();
            audioPlayer.src = '';
            cdInput.value = '';
            isCDMode = false;
            cdDisc.classList.add('empty');
            cdDisc.classList.remove('spinning');
            cdSlotDisc.classList.remove('loaded');
            cdSlotLed.className = 'cd-slot-led';
            nowPlaying.textContent = 'NO DISC';
            playPauseBtn.textContent = '▶';
            sourceIndicator.textContent = 'TUNER';
            bandDisplay.textContent = 'FM';
            freqDisplay.textContent = '87.5';
            trackTime.textContent = '0:00';
            if (stations[currentIndex]) loadStation(currentIndex);
        }
    });

    // ============ KEYBOARD ============
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') { e.preventDefault(); playPauseBtn.click(); }
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

    // ============ AC / CLIMATE ============
    let climateTemp = 22;
    let acOn = false;
    let fanSpeed = 2;

    const climateTempDisplay = document.getElementById('climate-temp');
    const climateAcBtn = document.getElementById('climate-ac-btn');
    const climateTempUp = document.getElementById('climate-temp-up');
    const climateTempDown = document.getElementById('climate-temp-down');
    const fanUp = document.getElementById('fan-up');
    const fanDown = document.getElementById('fan-down');
    const fanIndicator = document.getElementById('fan-indicator');

    function updateClimateDisplay() {
        climateTempDisplay.textContent = `${climateTemp}°C`;
        climateAcBtn.classList.toggle('on', acOn);
        const spans = fanIndicator.querySelectorAll('span');
        spans.forEach((span, i) => span.classList.toggle('on', i < fanSpeed));
    }

    climateTempUp.addEventListener('click', () => {
        if (climateTemp < 30) { climateTemp++; updateClimateDisplay(); }
    });
    climateTempDown.addEventListener('click', () => {
        if (climateTemp > 16) { climateTemp--; updateClimateDisplay(); }
    });
    climateAcBtn.addEventListener('click', () => {
        acOn = !acOn;
        updateClimateDisplay();
    });
    fanUp.addEventListener('click', () => {
        if (fanSpeed < 4) { fanSpeed++; updateClimateDisplay(); }
    });
    fanDown.addEventListener('click', () => {
        if (fanSpeed > 0) { fanSpeed--; updateClimateDisplay(); }
    });

    updateClimateDisplay();
});
