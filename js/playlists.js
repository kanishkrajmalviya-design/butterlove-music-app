/**
 * ButterLove Custom Playlist Manager
 * Allows couples to create custom playlists, add any song, manage & play playlists.
 */

const PlaylistManager = {
  STORAGE_KEY: 'butterlove_custom_playlists_v2',
  playlists: [],
  activePlaylistId: 'pl_favorites',

  init() {
    this.load();
    if (!this.playlists || this.playlists.length === 0) {
      this.playlists = [
        {
          id: 'pl_favorites',
          name: 'Our Love Vault',
          emoji: '💖',
          songs: []
        },
        {
          id: 'pl_drive',
          name: 'Long Drive Beats',
          emoji: '🚗',
          songs: []
        },
        {
          id: 'pl_latenight',
          name: 'Late Night Romance',
          emoji: '🌙',
          songs: []
        }
      ];
      this.save();
    }
  },

  load() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.playlists = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read playlists:', e);
    }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.playlists));
    } catch (e) {
      console.warn('Could not save playlists:', e);
    }
  },

  createPlaylist(name, emoji = '💖') {
    if (!name || !name.trim()) return null;
    const newPl = {
      id: 'pl_' + Date.now(),
      name: name.trim(),
      emoji: emoji || '💖',
      songs: []
    };
    this.playlists.push(newPl);
    this.save();
    window.showToast?.(`Playlist "${name}" created! 🦋`);
    return newPl;
  },

  addSongToPlaylist(playlistId, song) {
    if (!song) return false;
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return false;

    if (pl.songs.some((s) => s.id === song.id)) {
      window.showToast?.(`Song is already in "${pl.name}" 💕`);
      return false;
    }

    pl.songs.unshift({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album || 'Single',
      duration: song.duration,
      durationFormatted: song.durationFormatted,
      cover: song.cover,
      audioUrl: song.audioUrl,
      dedication: song.dedication || 'Added to playlist with love 💕'
    });

    this.save();
    window.showToast?.(`Added to "${pl.name}" 💖`);
    return true;
  },

  removeSongFromPlaylist(playlistId, songId) {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    pl.songs = pl.songs.filter((s) => s.id !== songId);
    this.save();
    window.showToast?.(`Song removed from "${pl.name}"`);
  },

  deletePlaylist(playlistId) {
    if (playlistId === 'pl_favorites') {
      window.showToast?.('Default Love Vault cannot be deleted');
      return;
    }
    this.playlists = this.playlists.filter((p) => p.id !== playlistId);
    if (this.activePlaylistId === playlistId) {
      this.activePlaylistId = 'pl_favorites';
    }
    this.save();
    window.showToast?.('Playlist deleted');
  },

  getPlaylist(playlistId) {
    return this.playlists.find((p) => p.id === playlistId);
  },

  getAllPlaylists() {
    return this.playlists;
  }
};
