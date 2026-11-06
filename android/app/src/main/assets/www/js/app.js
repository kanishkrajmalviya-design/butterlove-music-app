/**
 * ButterLove Main App Controller
 * Audio Player, UI Orchestration, Continuous Autoplay & Custom Playlists
 */

const App = {
  audio: new Audio(),
  playlist: [],
  currentIndex: -1,
  isPlaying: false,
  isShuffle: false,
  isRepeat: false,
  isUserScrubbing: false,
  sleepTimerTimeout: null,
  activeTab: 'home',
  selectedPlaylistEmoji: '💖',
  pendingAddSongId: null,

  init() {
    this.audio.crossOrigin = 'anonymous';
    this.audio.autoplay = true;

    CoupleManager.init();
    PlaylistManager.init();
    MusicAPI.init();

    this.setupAudioListeners();
    this.setupUIEvents();
    this.setupServiceWorker();
    this.loadInitialSongs();
  },

  setupAudioListeners() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayState();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayState();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.updateProgress();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.updateProgress();
    });

    this.audio.addEventListener('durationchange', () => {
      this.updateProgress();
    });

    // 100% Reliable Continuous Autoplay: Plays the next song automatically!
    this.audio.addEventListener('ended', () => {
      if (this.isRepeat) {
        this.audio.currentTime = 0;
        this.audio.play().catch((e) => console.log(e));
      } else {
        this.nextTrack();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio stream error, advancing safely to next track:', e);
      setTimeout(() => this.nextTrack(), 1200);
    });
  },

  async loadInitialSongs() {
    this.playlist = [...MusicAPI.localTracks];
    this.renderSongs(this.playlist);

    if (!CoupleManager.data.ourSong || !CoupleManager.data.ourSong.audioUrl) {
      CoupleManager.data.ourSong = this.playlist[0];
      CoupleManager.updateUI();
    }

    // Auto-fetch real-time latest & trending releases from Spotify/JioSaavn
    try {
      const liveTrending = await MusicAPI.getTrendingSongs();
      if (liveTrending && liveTrending.length > 0) {
        const existingIds = new Set(this.playlist.map((s) => s.id));
        const newSongs = liveTrending.filter((s) => !existingIds.has(s.id));
        if (newSongs.length > 0) {
          this.playlist = [...newSongs, ...this.playlist];
          this.renderSongs(this.playlist);
        }
      }
    } catch (e) {
      // Offline fallback
    }
  },

  renderSongs(songs, containerId = 'songsList') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!songs || songs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-dim);">
          <div style="font-size:36px; margin-bottom:10px;">🦋</div>
          <p>No songs found. Try searching any song, artist or album!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = songs
      .map((song, idx) => {
        const isCurrent = this.currentIndex >= 0 && this.playlist[this.currentIndex]?.id === song.id;
        const isLoved = CoupleManager.isFavorite(song.id, 'our');
        const dedication = CoupleManager.getDedication(song.id);
        const fallbackCover = createVectorCover(song.title, song.artist, '🦋', '#ff2a6d', '#7209b7');

        return `
        <div class="song-item ${isCurrent ? 'active-playing' : ''}" data-id="${song.id}" onclick="App.playFromContainer('${containerId}', ${idx})">
          <div class="song-left">
            <div class="song-cover-wrapper">
              <img src="${song.cover || fallbackCover}" class="song-cover" alt="${this.escapeHTML(song.title)}" onerror="this.onerror=null; this.src='${fallbackCover}'" loading="lazy" />
              <div class="playing-bars">
                <span class="pbar"></span>
                <span class="pbar"></span>
                <span class="pbar"></span>
              </div>
            </div>
            <div class="song-details">
              <div class="song-title">${this.escapeHTML(song.title)}</div>
              <div class="song-artist">${this.escapeHTML(song.artist)} • <span style="color:var(--soft-pink); font-weight:700;">${song.durationFormatted || (Math.floor(song.duration/60) + ':' + (song.duration%60<10?'0':'') + (song.duration%60))} Full</span></div>
              ${dedication ? `<div style="font-size:10px; color:var(--soft-pink); margin-top:2px;">💌 "${this.escapeHTML(dedication.message)}"</div>` : ''}
            </div>
          </div>
          <div class="song-actions" onclick="event.stopPropagation()">
            <button class="song-action-btn" title="Add to Playlist" onclick="App.openAddToPlaylistModal('${song.id}')">➕</button>
            <button class="song-action-btn" title="Dedicate to Partner" onclick="App.openDedicateModal('${song.id}')">💌</button>
            <button class="song-action-btn ${isLoved ? 'loved' : ''}" title="Favorite" onclick="App.toggleLove(event, '${song.id}')">${isLoved ? '💖' : '🤍'}</button>
          </div>
        </div>
      `;
      })
      .join('');
  },

  playFromContainer(containerId, index) {
    if (containerId === 'favoritesList') {
      const activePl = PlaylistManager.getPlaylist(PlaylistManager.activePlaylistId);
      const list = (activePl && activePl.songs && activePl.songs.length > 0)
        ? activePl.songs
        : (CoupleManager.data.favorites.our || []);
      this.playlist = list;
    }
    this.playAtIndex(index);
  },

  playSong(song) {
    if (!song || !song.audioUrl) return;

    const existingIdx = this.playlist.findIndex((s) => s.id === song.id);
    if (existingIdx >= 0) {
      this.currentIndex = existingIdx;
    } else {
      this.playlist.unshift(song);
      this.currentIndex = 0;
      this.renderSongs(this.playlist);
    }

    this.audio.src = song.audioUrl;
    this.audio.currentTime = 0;
    this.audio.autoplay = true;
    this.audio.play().catch((err) => console.log('Autoplay gesture deferral:', err));
    this.updateTrackInfo(song);
    this.updatePlayState();
    this.updateMediaSession(song);
    this.renderSongs(this.playlist);
  },

  playAtIndex(index) {
    if (index >= 0 && index < this.playlist.length) {
      this.currentIndex = index;
      const song = this.playlist[index];
      this.audio.src = song.audioUrl;
      this.audio.currentTime = 0;
      this.audio.autoplay = true;

      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.isPlaying = true;
          this.updatePlayState();
        }).catch((err) => {
          console.warn('Autoplay wait:', err);
          this.isPlaying = false;
          this.updatePlayState();
        });
      }

      this.updateTrackInfo(song);
      this.updatePlayState();
      this.updateMediaSession(song);
      this.renderSongs(this.playlist);
    }
  },

  togglePlay() {
    if (this.currentIndex === -1) {
      if (this.playlist.length > 0) {
        this.playAtIndex(0);
      }
      return;
    }

    if (this.audio.paused) {
      this.audio.play().catch((e) => console.log(e));
    } else {
      this.audio.pause();
    }
  },

  // Advances automatically to the next song in the active playlist
  nextTrack() {
    if (this.playlist.length === 0) return;
    if (this.isShuffle) {
      let nextIdx = Math.floor(Math.random() * this.playlist.length);
      if (this.playlist.length > 1 && nextIdx === this.currentIndex) {
        nextIdx = (nextIdx + 1) % this.playlist.length;
      }
      this.currentIndex = nextIdx;
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    }
    this.playAtIndex(this.currentIndex);
  },

  prevTrack() {
    if (this.playlist.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playAtIndex(this.currentIndex);
  },

  updateTrackInfo(song) {
    const backupCover = createVectorCover(song.title, song.artist, '🦋', '#ff2a6d', '#7209b7');

    // Mini player
    const miniCover = document.getElementById('miniCover');
    if (miniCover) {
      miniCover.src = song.cover || backupCover;
      miniCover.onerror = () => { miniCover.src = backupCover; };
    }
    document.getElementById('miniTitle').textContent = song.title;
    document.getElementById('miniArtist').textContent = song.artist;
    document.getElementById('miniPlayer').style.display = 'flex';

    // Now playing modal
    const npCover = document.getElementById('npCover');
    if (npCover) {
      npCover.src = song.cover || backupCover;
      npCover.onerror = () => { npCover.src = backupCover; };
    }
    document.getElementById('npTitle').textContent = song.title;
    document.getElementById('npArtist').textContent = song.artist;

    const dedication = CoupleManager.getDedication(song.id);
    const npDedication = document.getElementById('npDedication');
    if (dedication) {
      npDedication.style.display = 'flex';
      npDedication.innerHTML = `💌 From <b>${this.escapeHTML(dedication.sender)}</b>: "${this.escapeHTML(dedication.message)}"`;
    } else {
      npDedication.style.display = 'none';
    }

    // Favorite heart state in Now Playing
    const isLoved = CoupleManager.isFavorite(song.id, 'our');
    document.getElementById('npLoveBtn').textContent = isLoved ? '💖' : '🤍';
  },

  updatePlayState() {
    const miniPlayIcon = document.getElementById('miniPlayIcon');
    const npPlayIcon = document.getElementById('npPlayIcon');
    const npCover = document.getElementById('npCover');

    if (this.isPlaying) {
      if (miniPlayIcon) miniPlayIcon.textContent = '⏸';
      if (npPlayIcon) npPlayIcon.textContent = '⏸';
      if (npCover) npCover.classList.add('spinning');
    } else {
      if (miniPlayIcon) miniPlayIcon.textContent = '▶';
      if (npPlayIcon) npPlayIcon.textContent = '▶';
      if (npCover) npCover.classList.remove('spinning');
    }

    document.querySelectorAll('.song-item').forEach((item, idx) => {
      if (idx === this.currentIndex) {
        item.classList.add('active-playing');
      } else {
        item.classList.remove('active-playing');
      }
    });
  },

  updateProgress() {
    if (this.isUserScrubbing) return;

    const song = this.playlist[this.currentIndex];
    const cur = (Number.isFinite(this.audio.currentTime) && this.audio.currentTime >= 0) ? this.audio.currentTime : 0;
    const dur = (Number.isFinite(this.audio.duration) && this.audio.duration > 0)
      ? this.audio.duration
      : (song && Number.isFinite(song.duration) ? song.duration : 260);

    const slider = document.getElementById('seekSlider');
    const curTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');

    if (slider) {
      slider.value = dur > 0 ? (cur / dur) * 100 : 0;
    }

    if (curTimeEl) curTimeEl.textContent = this.formatTime(cur);
    if (totalTimeEl) totalTimeEl.textContent = this.formatTime(dur);
  },

  seek(percent) {
    const song = this.playlist[this.currentIndex];
    const dur = (Number.isFinite(this.audio.duration) && this.audio.duration > 0)
      ? this.audio.duration
      : (song && Number.isFinite(song.duration) ? song.duration : 260);

    const targetTime = (parseFloat(percent) / 100) * dur;
    if (Number.isFinite(targetTime) && targetTime >= 0) {
      try {
        this.audio.currentTime = targetTime;
      } catch (e) {
        console.warn('Seek error:', e);
      }
    }
  },

  formatTime(seconds) {
    if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  },

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    document.getElementById('npShuffleBtn').classList.toggle('active', this.isShuffle);
    window.showToast(this.isShuffle ? 'Shuffle On 🔀' : 'Shuffle Off');
  },

  toggleRepeat() {
    this.isRepeat = !this.isRepeat;
    document.getElementById('npRepeatBtn').classList.toggle('active', this.isRepeat);
    window.showToast(this.isRepeat ? 'Repeat Song On 🔁' : 'Repeat Off');
  },

  toggleLove(event, songId) {
    const song = this.playlist.find((s) => s.id === songId) || CoupleManager.data.ourSong;
    if (!song) return;

    const isLoved = CoupleManager.toggleFavorite(song, 'our');
    if (event && event.currentTarget) {
      event.currentTarget.classList.toggle('loved', isLoved);
      event.currentTarget.textContent = isLoved ? '💖' : '🤍';
    }

    const npLove = document.getElementById('npLoveBtn');
    if (npLove && this.playlist[this.currentIndex]?.id === songId) {
      npLove.textContent = isLoved ? '💖' : '🤍';
    }

    // Also mirror into default Love Vault playlist
    if (isLoved) {
      PlaylistManager.addSongToPlaylist('pl_favorites', song);
    } else {
      PlaylistManager.removeSongFromPlaylist('pl_favorites', song.id);
    }

    if (this.activeTab === 'favorites') {
      this.renderPlaylistsView();
    }
  },

  openNowPlaying() {
    document.getElementById('nowPlayingModal').classList.add('open');
  },

  closeNowPlaying() {
    document.getElementById('nowPlayingModal').classList.remove('open');
  },

  openFullSong() {
    const song = this.playlist[this.currentIndex];
    if (!song) return;
    const query = encodeURIComponent(`${song.title} ${song.artist} full song`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  },

  openDedicateModal(songId) {
    const song = this.playlist.find((s) => s.id === songId) || this.playlist[this.currentIndex];
    if (!song) return;
    document.getElementById('dedicateSongId').value = song.id;
    document.getElementById('dedicateSongName').textContent = `"${song.title}"`;
    document.getElementById('dedicateModal').classList.add('open');
  },

  closeDedicateModal() {
    document.getElementById('dedicateModal').classList.remove('open');
  },

  submitDedication() {
    const songId = document.getElementById('dedicateSongId').value;
    const msg = document.getElementById('dedicateMsg').value;
    const sender = document.getElementById('dedicateSender').value || CoupleManager.data.partner1;

    if (!msg.trim()) {
      window.showToast('Please enter a sweet love note 💌');
      return;
    }

    CoupleManager.dedicate(songId, msg, sender);
    document.getElementById('dedicateMsg').value = '';
    this.closeDedicateModal();
    this.renderSongs(this.playlist);
    if (this.playlist[this.currentIndex]?.id === songId) {
      this.updateTrackInfo(this.playlist[this.currentIndex]);
    }
  },

  /* ============================================================
     CUSTOM PLAYLIST SYSTEM
     ============================================================ */
  openCreatePlaylistModal() {
    document.getElementById('createPlaylistModal').classList.add('open');
    document.getElementById('newPlaylistNameInput').value = '';
    this.selectedPlaylistEmoji = '💖';
    document.querySelectorAll('#emojiPickerRow .emoji-opt').forEach((el) => {
      el.classList.toggle('active', el.textContent.trim() === '💖');
    });
    document.getElementById('newPlaylistNameInput').focus();
  },

  closeCreatePlaylistModal() {
    document.getElementById('createPlaylistModal').classList.remove('open');
  },

  selectPlaylistEmoji(emoji, el) {
    this.selectedPlaylistEmoji = emoji;
    document.querySelectorAll('#emojiPickerRow .emoji-opt').forEach((e) => e.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  saveNewPlaylist() {
    const name = document.getElementById('newPlaylistNameInput').value.trim();
    if (!name) {
      window.showToast('Please enter a playlist name 💕');
      return;
    }
    const newPl = PlaylistManager.createPlaylist(name, this.selectedPlaylistEmoji);
    this.closeCreatePlaylistModal();

    if (this.pendingAddSongId) {
      const song = this.playlist.find((s) => s.id === this.pendingAddSongId) || MusicAPI.localTracks.find((s) => s.id === this.pendingAddSongId);
      if (song) {
        PlaylistManager.addSongToPlaylist(newPl.id, song);
      }
      this.pendingAddSongId = null;
    }

    if (this.activeTab === 'favorites') {
      PlaylistManager.activePlaylistId = newPl.id;
      this.renderPlaylistsView();
    }
  },

  openAddToPlaylistModal(songId) {
    this.pendingAddSongId = songId;
    const song = this.playlist.find((s) => s.id === songId) || MusicAPI.localTracks.find((s) => s.id === songId);
    if (!song) return;

    document.getElementById('addToSongId').value = song.id;
    document.getElementById('addToSongTitle').textContent = `"${song.title}"`;

    const pickerList = document.getElementById('playlistPickerList');
    const allPls = PlaylistManager.getAllPlaylists();

    pickerList.innerHTML = allPls
      .map((pl) => {
        const contains = pl.songs && pl.songs.some((s) => s.id === song.id);
        return `
        <div class="playlist-picker-item" onclick="App.addSongToSelectedPlaylist('${pl.id}')">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">${pl.emoji || '🎵'}</span>
            <div>
              <div style="font-size:13px; font-weight:700; color:#fff;">${this.escapeHTML(pl.name)}</div>
              <div style="font-size:11px; color:var(--soft-pink);">${pl.songs ? pl.songs.length : 0} songs</div>
            </div>
          </div>
          <span style="font-size:14px; color:${contains ? 'var(--primary-pink)' : 'var(--text-dim)'};">${contains ? '✓ Added' : '➕ Add'}</span>
        </div>
      `;
      })
      .join('');

    document.getElementById('addToPlaylistModal').classList.add('open');
  },

  closeAddToPlaylistModal() {
    document.getElementById('addToPlaylistModal').classList.remove('open');
    this.pendingAddSongId = null;
  },

  addSongToSelectedPlaylist(playlistId) {
    const songId = document.getElementById('addToSongId').value || this.pendingAddSongId;
    const song = this.playlist.find((s) => s.id === songId) || MusicAPI.localTracks.find((s) => s.id === songId);
    if (!song) return;

    PlaylistManager.addSongToPlaylist(playlistId, song);
    this.closeAddToPlaylistModal();
    if (this.activeTab === 'favorites') {
      this.renderPlaylistsView();
    }
  },

  renderPlaylistsView() {
    const scrollContainer = document.getElementById('playlistsCardsScroll');
    const allPls = PlaylistManager.getAllPlaylists();
    const activePlId = PlaylistManager.activePlaylistId || allPls[0]?.id;

    if (scrollContainer) {
      scrollContainer.innerHTML = allPls
        .map((pl) => {
          const isActive = pl.id === activePlId;
          return `
          <div class="playlist-chip-card ${isActive ? 'active' : ''}" onclick="App.selectPlaylist('${pl.id}')">
            <div class="playlist-chip-emoji">${pl.emoji || '💖'}</div>
            <div class="playlist-chip-name">${this.escapeHTML(pl.name)}</div>
            <div class="playlist-chip-count">${pl.songs ? pl.songs.length : 0} Songs</div>
          </div>
        `;
        })
        .join('');
    }

    const currentPl = PlaylistManager.getPlaylist(activePlId) || allPls[0];
    if (currentPl) {
      document.getElementById('activePlaylistTitle').textContent = `${currentPl.emoji || '🎵'} ${currentPl.name}`;
      const deleteBtn = document.getElementById('deletePlaylistBtn');
      if (deleteBtn) {
        deleteBtn.style.display = currentPl.id === 'pl_favorites' ? 'none' : 'block';
      }
      this.renderSongs(currentPl.songs || [], 'favoritesList');
    }
  },

  selectPlaylist(playlistId) {
    PlaylistManager.activePlaylistId = playlistId;
    this.renderPlaylistsView();
  },

  playActivePlaylist() {
    const pl = PlaylistManager.getPlaylist(PlaylistManager.activePlaylistId);
    if (!pl || !pl.songs || pl.songs.length === 0) {
      window.showToast('This playlist is empty. Tap ➕ on any song to add it! 💕');
      return;
    }
    this.playlist = [...pl.songs];
    this.playAtIndex(0);
    window.showToast(`Playing "${pl.name}" 🎶`);
  },

  deleteActivePlaylist() {
    const id = PlaylistManager.activePlaylistId;
    if (confirm('Are you sure you want to delete this custom playlist?')) {
      PlaylistManager.deletePlaylist(id);
      this.renderPlaylistsView();
    }
  },

  openCoupleModal() {
    document.getElementById('partner1Input').value = CoupleManager.data.partner1;
    document.getElementById('partner2Input').value = CoupleManager.data.partner2;
    document.getElementById('startDateInput').value = CoupleManager.data.startDate;
    document.getElementById('coupleModal').classList.add('open');
  },

  closeCoupleModal() {
    document.getElementById('coupleModal').classList.remove('open');
  },

  toggleInlineNameEdit(e) {
    if (e) e.stopPropagation();
    const form = document.getElementById('quickNamesForm');
    if (!form) return;
    const isHidden = form.style.display === 'none' || !form.style.display;
    form.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      document.getElementById('quickP1').value = CoupleManager.data.partner1;
      document.getElementById('quickP2').value = CoupleManager.data.partner2;
      document.getElementById('quickP1').focus();
    }
  },

  saveQuickNames() {
    const p1 = document.getElementById('quickP1').value.trim();
    const p2 = document.getElementById('quickP2').value.trim();
    if (!p1 || !p2) {
      window.showToast('Please enter both partner names 💕');
      return;
    }
    CoupleManager.setCoupleNames(p1, p2);
    document.getElementById('quickNamesForm').style.display = 'none';
  },

  saveSpaceProfile() {
    const p1 = document.getElementById('spaceP1Input').value.trim();
    const p2 = document.getElementById('spaceP2Input').value.trim();
    const date = document.getElementById('spaceDateInput').value;
    if (!p1 || !p2) {
      window.showToast('Please enter both partner names 💕');
      return;
    }
    CoupleManager.data.partner1 = p1;
    CoupleManager.data.partner2 = p2;
    if (date) CoupleManager.data.startDate = date;
    CoupleManager.save();
    window.showToast(`Names updated: ${p1} & ${p2} 💖`);
  },

  saveCoupleProfile() {
    CoupleManager.data.partner1 = document.getElementById('partner1Input').value.trim() || 'Partner 1';
    CoupleManager.data.partner2 = document.getElementById('partner2Input').value.trim() || 'Partner 2';
    CoupleManager.data.startDate = document.getElementById('startDateInput').value || CoupleManager.data.startDate;
    CoupleManager.save();
    this.closeCoupleModal();
    window.showToast('Couple Profile Updated 💕');
  },

  openSleepTimerModal() {
    document.getElementById('sleepModal').classList.add('open');
  },

  closeSleepTimerModal() {
    document.getElementById('sleepModal').classList.remove('open');
  },

  setSleepTimer(minutes) {
    if (this.sleepTimerTimeout) clearTimeout(this.sleepTimerTimeout);

    if (minutes === 0) {
      window.showToast('Sleep timer turned off');
      this.closeSleepTimerModal();
      return;
    }

    this.sleepTimerTimeout = setTimeout(() => {
      this.audio.pause();
      window.showToast('Goodnight lovers 🌙 Music paused.');
    }, minutes * 60 * 1000);

    window.showToast(`Sleep timer set for ${minutes} minutes 🌙`);
    this.closeSleepTimerModal();
  },

  pinCurrentAsOurSong() {
    if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
      CoupleManager.setOurSong(this.playlist[this.currentIndex]);
    }
  },

  playOurSong() {
    if (CoupleManager.data.ourSong) {
      this.playSong(CoupleManager.data.ourSong);
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.nav-tab').forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    const homeView = document.getElementById('homeView');
    const favView = document.getElementById('favoritesView');
    const coupleView = document.getElementById('coupleView');

    if (homeView) homeView.style.display = tab === 'home' ? 'block' : 'none';
    if (favView) favView.style.display = tab === 'favorites' ? 'block' : 'none';
    if (coupleView) coupleView.style.display = tab === 'couple' ? 'block' : 'none';

    if (tab === 'favorites') {
      this.renderPlaylistsView();
    }
  },

  setupUIEvents() {
    // Live Search input
    let searchTimeout = null;
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearBtn.style.display = query ? 'block' : 'none';

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
          if (query.length > 0) {
            document.getElementById('songsHeaderTitle').textContent = `Results for "${query}"`;
            const songs = await MusicAPI.searchSongs(query);
            this.playlist = songs;
            this.renderSongs(this.playlist);
          } else {
            document.getElementById('songsHeaderTitle').textContent = 'Trending Love Songs';
            this.loadInitialSongs();
          }
        }, 280);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        document.getElementById('songsHeaderTitle').textContent = 'Trending Love Songs';
        this.loadInitialSongs();
      });
    }

    // Mood pills
    document.querySelectorAll('.mood-pill').forEach((pill) => {
      pill.addEventListener('click', async () => {
        document.querySelectorAll('.mood-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');

        const mood = pill.dataset.mood;
        document.getElementById('songsHeaderTitle').textContent = `${pill.textContent.trim()} Songs`;
        const songs = await MusicAPI.getSongsByMood(mood);
        this.playlist = songs;
        this.renderSongs(this.playlist);
      });
    });

    // Seek bar slider with Scrubbing Lock
    const seekSlider = document.getElementById('seekSlider');
    if (seekSlider) {
      seekSlider.addEventListener('mousedown', () => { this.isUserScrubbing = true; });
      seekSlider.addEventListener('touchstart', () => { this.isUserScrubbing = true; }, { passive: true });

      seekSlider.addEventListener('input', (e) => {
        const song = this.playlist[this.currentIndex];
        const dur = (Number.isFinite(this.audio.duration) && this.audio.duration > 0)
          ? this.audio.duration
          : (song && Number.isFinite(song.duration) ? song.duration : 260);
        const previewSec = (parseFloat(e.target.value) / 100) * dur;
        const curTimeEl = document.getElementById('currentTime');
        if (curTimeEl) curTimeEl.textContent = this.formatTime(previewSec);
      });

      seekSlider.addEventListener('change', (e) => {
        this.isUserScrubbing = false;
        this.seek(e.target.value);
      });

      seekSlider.addEventListener('mouseup', () => { this.isUserScrubbing = false; });
      seekSlider.addEventListener('touchend', () => { this.isUserScrubbing = false; });
    }
  },

  updateMediaSession(song) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album || 'ButterLove Couples',
        artwork: [
          { src: song.cover || 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: song.cover || 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
    }
  },

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.log('SW registration error:', err);
        });
      });
    }
  },

  escapeHTML(str) {
    return (str || '').replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }
};

// Global Toast System
window.showToast = function (message) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast-msg';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
};

// Start app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => App.init());
