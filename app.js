document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('audio-player');
    const nowPlaying = document.getElementById('now-playing');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const volumeKnob = document.getElementById('volume-knob');
    const cdInput = document.getElementById('cd-input');

    let stations = [];
    let currentIndex = 0;

    // Set initial volume
    audioPlayer.volume = 0.5;

    // Fetch stations with CORS proxy
    const proxy = 'https://corsproxy.io/?';
    const apiUrl = 'https://de1.api.radio-browser.info/json/stations?limit=10';
    
    fetch(proxy + encodeURIComponent(apiUrl))
        .then(response => response.json())
        .then(data => {
            stations = data;
        })
        .catch(err => console.error('Error fetching stations:', err));

    function loadStation(index) {
        currentIndex = index;
        const station = stations[index];
        audioPlayer.src = station.url;
        audioPlayer.play();
        nowPlaying.textContent = station.name;
        playPauseBtn.textContent = '⏸';
    }

    // Controls
    playPauseBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            audioPlayer.play();
            playPauseBtn.textContent = '⏸';
        } else {
            audioPlayer.pause();
            playPauseBtn.textContent = '▶';
        }
    });

    nextBtn.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % stations.length;
        loadStation(currentIndex);
    });

    prevBtn.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + stations.length) % stations.length;
        loadStation(currentIndex);
    });

    // Preset handling
    document.querySelectorAll('.preset').forEach(button => {
        button.addEventListener('click', () => {
            const index = parseInt(button.getAttribute('data-index'));
            if (stations[index]) {
                loadStation(index);
            }
        });
    });

    // Volume Knob Logic
    let isDragging = false;
    let angle = 135; // Default middle position

    function updateVolumeFromAngle(deg) {
        // Map 0-270 range to 0-1 volume
        let vol = Math.min(Math.max((deg / 270), 0), 1);
        audioPlayer.volume = vol;
        volumeKnob.style.transform = `rotate(${deg - 135}deg)`;
    }

    volumeKnob.addEventListener('mousedown', () => isDragging = true);
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = volumeKnob.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let deg = rad * (180 / Math.PI) + 90; // Convert to degrees, offset
        if (deg < 0) deg += 360;
        
        // Limit angle to roughly 0-270 range for a knob feel
        if (deg > 315 || deg < 45) {
             angle = (deg > 315) ? 0 : 270;
        } else {
            angle = deg - 45;
        }
        updateVolumeFromAngle(angle);
    });
    document.addEventListener('mouseup', () => isDragging = false);

    // CD Player Logic
    cdInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            audioPlayer.src = URL.createObjectURL(file);
            audioPlayer.play();
            nowPlaying.textContent = `CD: ${file.name}`;
            playPauseBtn.textContent = '⏸';
        }
    });
});
