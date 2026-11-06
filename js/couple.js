/**
 * ButterLove Couple Feature Manager
 * Manages couple profile, love anniversary counter, song dedications, and shared/his/her playlists.
 */

const CoupleManager = {
  data: {
    partner1: 'You',
    partner2: 'Soulmate',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ourSong: {
      id: 'song_1',
      title: 'Kesariya',
      artist: 'Pritam & Arijit Singh',
      duration: 268,
      durationFormatted: '4:28',
      audioUrl: 'https://aac.saavncdn.com/871/c2febd353f3a076a406fa37510f31f9f_160.mp4'
    },
    dedications: {},
    favorites: {
      our: [],
      his: [],
      her: []
    }
  },

  STORAGE_KEY: 'butterlove_couple_state_v1',

  init() {
    this.load();
    this.updateUI();
  },

  load() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.data = { ...this.data, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Could not read couple data from localStorage:', e);
    }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not save couple data:', e);
    }
    this.updateUI();
  },

  getDaysTogether() {
    const start = new Date(this.data.startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  },

  updateUI() {
    const titleEl = document.getElementById('coupleTitleText');
    const daysEl = document.getElementById('coupleDaysText');
    const pinnedTitle = document.getElementById('pinnedSongTitle');

    if (titleEl) {
      titleEl.innerHTML = `${this.data.partner1} <span class="heart-icon">💖</span> ${this.data.partner2}`;
    }

    if (daysEl) {
      const days = this.getDaysTogether();
      daysEl.textContent = `${days} Days Together in Love 🦋`;
    }

    if (pinnedTitle && this.data.ourSong) {
      pinnedTitle.textContent = `${this.data.ourSong.title} - ${this.data.ourSong.artist}`;
    }

    // Sync input fields if present
    ['quickP1', 'spaceP1Input', 'partner1Input'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = this.data.partner1;
    });

    ['quickP2', 'spaceP2Input', 'partner2Input'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = this.data.partner2;
    });

    ['spaceDateInput', 'startDateInput'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = this.data.startDate;
    });
  },

  setCoupleNames(p1, p2) {
    if (p1 && p1.trim()) this.data.partner1 = p1.trim();
    if (p2 && p2.trim()) this.data.partner2 = p2.trim();
    this.save();
    window.showToast?.(`Couple names updated to "${this.data.partner1} & ${this.data.partner2}" 💕`);
  },

  setOurSong(song) {
    this.data.ourSong = song;
    this.save();
    window.showToast?.(`Pinned "${song.title}" as Our Song! 💖`);
  },

  dedicate(songId, message, sender) {
    this.data.dedications[songId] = {
      message: message.trim(),
      sender: sender || this.data.partner1,
      date: new Date().toLocaleDateString()
    };
    this.save();
    window.showToast?.('Love dedication sent! 💕');
  },

  getDedication(songId) {
    return this.data.dedications[songId] || null;
  },

  toggleFavorite(song, listType = 'our') {
    const list = this.data.favorites[listType] || [];
    const idx = list.findIndex((s) => s.id === song.id);

    if (idx >= 0) {
      list.splice(idx, 1);
      this.save();
      window.showToast?.(`Removed from ${listType} favorites`);
      return false;
    } else {
      list.push(song);
      this.save();
      window.showToast?.(`Added to ${listType} favorites 💕`);
      return true;
    }
  },

  isFavorite(songId, listType = 'our') {
    const list = this.data.favorites[listType] || [];
    return list.some((s) => s.id === songId);
  }
};
